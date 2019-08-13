var app = angular.module("umbraco");
var api_base_url = "https://api.textmetrics.com/",
    edit_content_url = "/content/edit",
    login_url = "/login";

//Angular modules to inject/require. Actual file is located in package.manifest
app.requires.push('tc.chartjs', 'ngTagsInput', 'ui.bootstrap.progressbar', 'ui.bootstrap.collapse', 'scrollable-table', 'ui.bootstrap.tooltip', 'ui.bootstrap.popover');

function ContentEventsService() {
    var listeners = [];

    this.register = function(listener) {
        listeners.push(listener);
    };

    this.unregister = function(listener) {
        var index = listeners.indexOf(listener);
        listeners.splice(index, 1);
    };

    this.raise = function(type) {
        var i;
        for (i = 0; i < listeners.length; i++) {
            listeners[i](type);
        }
    };
}

app.service("content-events-service", [
    ContentEventsService
]);

app.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.interceptors.push(["$q", "content-events-service", function ($q, httpEvents) {
        return {
            request: function (request) {
                if (request.url.indexOf("api.textmetrics.com") > 0) {
                    request.headers = request.headers || {};
                    request.headers.Authorization = 'Bearer ' + localStorage.getItem('wtt_token');
                    request.headers.WttSource = 'Umbraco';
                }                
                return request;
            },
            response: function (response) {
                if (response.config.url === "/umbraco/backoffice/UmbracoApi/Content/PostSave") {                   
                    if (response.config.data.value.action === "publish" || response.config.data.value.action === "save") {
                        httpEvents.raise("saved");
                    }
                }
                return response || $q.when(response);
            }
        };
    }]);
}]);

angular.module("umbraco.resources").factory("wttResource", function ($http) {
    return {
        getWttContentById: function(id) {
            return $http.get("backoffice/Webtexttool/Content/GetById?contentId=" + id);
        },
        getWttData: function () {
            return $http.get("backoffice/Webtexttool/Dashboard/GetWttData");
        }
    };
});

app.controller("WttPageController", ["content-events-service", "$scope", "httpService", "$q", "$cookies", "languageService", "keywordService", "$cookieStore", "suggestionsService", "stateService", "$sanitize", "$compile", "synonymService", "wttResource", "editorState", "$filter",
    function (httpEvents, $scope, httpService, $q, $cookies, languageService, keywordService, $cookieStore, suggestionsService, stateService, $sanitize, $compile, synonymService, wttResource, editorState, $filter) {
    var wttApiBaseUrl = api_base_url;
    var apiKey;
    var authCode;
    var $j = jQuery;
    var pageObject;
    var wttGlobals;
    $scope.Keyword = "";
    $scope.Description = "";

    var contentId = editorState.current.id;

    if (contentId !== null || contentId !== "") {
        wttResource.getWttContentById(contentId).then(function (response) {
            if (response.data !== null && response.data !== "null") {
                wttGlobals = response.data;

                $scope.Keyword = wttGlobals.Keywords;
                $scope.Description = wttGlobals.Description;
            }
        });
    }

    var getPageObject = function () {
        $j.ajax({
            url: 'backoffice/Webtexttool/Content/GetPageDetails?pageId=' + contentId,
            type: 'GET',
            async: false,
            contentType: 'application/json; charset=utf-8',
            success: function (response) {
                if (response !== null && response !== "null") {
                    pageObject = response;
                }
            },
            error: function (xhr) {
                console.log('GetPageDetails - error from GetPageDetails');
                console.log(xhr);
            }
        });
    };

    getPageObject();

    var saveWttContent = function() {
        var deffered = $q.defer();

        var data = {
            ContentId: contentId,
            Keywords: $scope.Keyword,
            Description: $scope.Description,
            Language: $scope.localLanguageCode,
            Synonyms: JSON.stringify($scope.pageKeywordSynonyms2)
        };

        $j.ajax({
            url: 'backoffice/Webtexttool/Content/Save',
            type: 'POST',
            dataType: 'json',
            data: data,
            success: function(result) {
                deffered.resolve(result);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log(JSON.stringify(jqXHR));
                console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
            }
        });

        return deffered.promise;
    };

    $scope.$watch("model", function () {
        // does not get destroyed, nor changed on save &| publish.
        $scope.message = ($scope.message || "");
    }, true);

    function posted(type) {
        $scope.message = ($scope.message || "");

        if (type === "saved" && contentId !== null && contentId !== "" && $scope.Keyword !== "") {
            saveWttContent().then(function () {
                getPageObject();
                $scope.useMyKeyword();
            });
        }
    }

    httpEvents.register(posted);

    $scope.$on("$destroy", function () {
        httpEvents.unregister(posted);
    });

    wttResource.getWttData().then(function (response) {
        apiKey = response.data.ApiKey;
        authCode = response.data.AccessToken;

        if (localStorage.getItem('wtt_token') === null || localStorage.getItem('wtt_token') === "") {
            if (authCode !== '') {
                localStorage.setItem('wtt_token', authCode);
            }

            if (apiKey !== '') {
                localStorage.setItem('wtt_token', apiKey);
            }
        }
    });

    httpService.getData(wttApiBaseUrl + "user/authenticated").then(function (result) {

        $scope.auth = result;

        if (result !== "false") {
            httpService.getData(wttApiBaseUrl + "user/info").then(function (userInfo) {
                $scope.userInfo = userInfo;
                $scope.runRules = false;
                $scope.runRulesTimeout = 3000;
                $scope.isCollapsed = false;
                $scope.ruleSet = 1;
                if (pageObject.pageType === 'Product')
                    $scope.ruleSet = 2;
                $scope.activeEngine = 'seo';
                $scope.HtmlContent = "";
                $scope.isReadingLevelDetailsCollapsed = true;
                var selectedPageNodes = [];
                var keywordSynonyms = null;

                $scope.htmlPopover = $sanitize('Select for which language/country you want to optimize your content. Enter your keyword. Add synonyms (optional).');
                $scope.htmlPopoverS = $sanitize('While writing, multiple suggestions appear here. These suggestions tell you how you can improve your text for the search engines, according to the latest SEO rules, but also how to structure your text for your readers. Following these suggestions, will raise your optimization score!');
                $scope.htmlPopoverP = $sanitize('Here you can set max 20 alternative keywords that support the main keyword.');
                $scope.htmlPopoverD = $sanitize("This is the summary of your page that will be shown in the search results and what a potential visitor of your page will see. So it's important to create a catchy description of your page.");

                $scope.activeLanguageCode = "en";

                $scope.setActiveLanguage = function (language) {
                    $scope.activeLanguageCode = language.LanguageCode;
                    $scope.languageCode = language.LanguageCode;
                };

                $cookieStore.put('wtt_lang', userInfo.DefaultLanguageCode);
                $scope.localLanguageCode = userInfo.DefaultLanguageCode;

                function getContent(id) {
                    return $j('#' + id).val();
                }

                $scope.pageHasKeyword = function () {
                    return $scope.Keyword.length !== 0;
                };

                function getHtmlAndRunSuggestions() {
                    $scope.runRules = true;
                    $scope.runSuggestions();
                }

                var synonymValues = [];

                if (typeof wttGlobals !== "undefined") {
                    synonymValues = wttGlobals.Synonyms ? JSON.parse(wttGlobals.Synonyms) : [];
                }

                if (synonymValues !== "") {
                    $scope.pageKeywordSynonyms = $j.map(synonymValues, function (element) {
                        return { text: element };
                    });

                    $scope.pageKeywordSynonyms2 = synonymValues;
                }               

                $scope.onSynonymsAdded = function (synonym) {
                    $scope.pageKeywordSynonyms.push({ text: synonym });                  
                };

                $scope.onSynonymsRemoved = function (synonym) {
                    for (var i = $scope.pageKeywordSynonyms.length - 1; i >= 0; --i) {
                        if ($scope.pageKeywordSynonyms[i].text === synonym) {
                            $scope.pageKeywordSynonyms.splice(i, 1);
                        }
                    }                    
                };

                $scope.getKeywordSynonyms = function (query) {

                    var synonymsDeferred = $q.defer();

                    if (_.isNull(keywordSynonyms)) {

                        if (getContent('wtt-keyword') !== "") {
                            var localKeyword = $scope.Keyword;

                            synonymService.getSynonyms(localKeyword)
                                .then(function (rawSynonymsData) {
                                    keywordSynonyms = _.pluck(rawSynonymsData.Associations, 'Synonym');
                                    synonymsDeferred.resolve(keywordSynonyms);
                                });
                        }
                    } else {
                        synonymsDeferred.resolve(keywordSynonyms);
                    }

                    return synonymsDeferred.promise;
                };

                $scope.fillKeyword = function (keyword) {
                    $scope.Keyword = keyword.Keyword;
                    setTimeout(function () {
                        $scope.submitSearchKeyword();
                    }, 500);
                };

                $scope.searchModel = {
                    "inputKeyword": "",
                    "KeywordSources": [],
                    "selectedSource": {},
                    "SearchResults": []
                };

                var keywordSourceLangCookie = $cookies.wtt_keyword_source_lang ? $cookies.wtt_keyword_source_lang.replace(/"/g, "") : "";

                if (keywordSourceLangCookie == "") {
                    $scope.searchModel.selectedSource = {
                        Key: "25635a34-4c76-4d1b-ac96-c12916b11b1f",
                        Name: "US - google.com",
                        Value: "us"
                    };

                    $cookieStore.put('wtt_keyword_source_lang', $scope.searchModel.selectedSource.Value.replace(/"/g, ""));
                }

                var keywordSourceCodeMap = {
                    en: "us"
                };

                // Get Google languages
                function loadKeywordSources() {
                    keywordService.getKeywordSources().then(
                        function loaded(keywordSources) {
                            $scope.KeywordSources = $filter('orderBy')(keywordSources, "Country", false);

                            var appLanguageCode = languageService.getActiveLanguageCode().replace(/""/g, "");
                            var mappedLanguageCode = keywordSourceCodeMap[appLanguageCode] || appLanguageCode;

                            var appLanguageKeywordSource = _.find(keywordSources, function (item) {
                                return item.Value == mappedLanguageCode;
                            });

                            var selectedKeywordSource = _.isUndefined(keywordSourceLangCookie) ? appLanguageKeywordSource : _.find(keywordSources, function (item) {
                                return item.Value == keywordSourceLangCookie;
                            });

                            $scope.searchModel.selectedSource = selectedKeywordSource;
                        });
                }

                // Mapping Keyword Scores
                var mapKeywordScores = function(keywords) {
                    var overallScoreLabelMap = {
                        0: "Very Poor",
                        1: "Moderate",
                        2: "Good"
                    };

                    var overallScoreHelpMap = {
                        0: "Overall Score Very Poor",
                        1: "Overall Score Moderate",
                        2: "Overall Score Good"
                    };

                    var overallScoreClassMap = {
                        0: "interval-very-poor",
                        1: "interval-moderate",
                        2: "interval-good"
                    };

                    var overallScoreLabelClassMap = {
                        0: "label-danger",
                        1: "label-warning",
                        2: "label-success"
                    };

                    var volumeScoreMap = {
                        0: {
                            className: "very-low",
                            label: "Very Low",
                            helpText: "Monthly search volume on this keyword is very low."
                        },
                        1: {
                            className: "low",
                            label: "Low",
                            helpText: "Monthly search volume on this keyword is low."
                        },
                        2: {
                            className: "moderate",
                            label: "Moderate",
                            helpText: "Monthly search volume on this keyword is moderate."
                        },
                        3: {
                            className: "high",
                            label: "High",
                            helpText:
                                "Monthly search volume on this keyword is high. A lot of searches are done on this keyword."
                        },
                        4: {
                            className: "very-high",
                            label: "Very High",
                            helpText:
                                "Monthly search volume on this keyword is very high. A lot of search are done on this keyword."
                        }
                    };

                    var competitionMap = {
                        4: {
                            className: "very-easy",
                            label: "Very Easy",
                            helpText:
                                "This means that competition is low on this keyword. Not a lot of (strong) sites are also optimised on this keyword."
                        },
                        3: {
                            className: "easy",
                            label: "Easy",
                            helpText:
                                "Competition on this keyword is not very strong. Not a lot of (strong) sites and pages are also optimised on this keyword."
                        },
                        2: {
                            className: "moderate",
                            label: "Moderate",
                            helpText:
                                "Competition on this keyword is moderate. Quite some (strong) sites and pages are also optimised on this keyword."
                        },
                        1: {
                            className: "hard",
                            label: "Hard",
                            helpText:
                                "Competition on this keyword is strong. A lot of (strong) sites and pages are also optimised on this keyword."
                        },
                        0: {
                            className: "very-hard",
                            label: "Very Hard",
                            helpText:
                                "Competition on this keyword is very strong. A lot of (strong) sites and pages are also optimised on this keyword."
                        }
                    };

                    _.each(keywords,
                        function(result) {
                            if (result.OverallScore >= 0) {
                                result.OverallScoreClass = overallScoreClassMap[result.OverallScore];
                                result.OverallScoreHelp = overallScoreHelpMap[result.OverallScore];
                                result.OverallScoreLabelClass = overallScoreLabelClassMap[result.OverallScore];
                                result.OverallScoreLabel = overallScoreLabelMap[result.OverallScore];
                            } else {
                                result.OverallScoreClass = "interval-moderate";
                                result.OverallScoreLabel = "N/A";
                                result.OverallScoreHelp =
                                    "This is an estimation because we have limited data on keyword volume and/or competition";
                                result.OverallScoreLabelClass = "label-warning";
                            }

                            if (result.VolumeScore >= 0) {
                                result.SearchVolumeScoreAttrs = volumeScoreMap[result.VolumeScore];
                            } else {
                                result.SearchVolumeScoreAttrs = {
                                    className: "moderate",
                                    label: "N/A",
                                    helpText:
                                        "This is a rough estimation because we have limited data on volume for this keyword."
                                };
                            }

                            if (result.CompetitionScore >= 0) {
                                result.CompetitionScoreAttrs = competitionMap[result.CompetitionScore];
                            } else {
                                result.CompetitionScoreAttrs = {
                                    className: "moderate",
                                    label: "N/A",
                                    helpText:
                                        "This is a rough estimation because we have limited data on competition for this keyword."
                                };
                            }
                        });
                    return keywords;
                };

                function hasCredits() {
                    return userInfo.Credits > 0;
                }

                function cleanKeyword(keyword) {
                    if (isNullOrEmpty(keyword)) {
                        return keyword;
                    }
                    return cleanMeta(keyword, false);
                }

                // replace with space the special chars and escape single quotes
                function cleanMeta(text, escape) {
                    // replace with space the special chars
                    var cleanText = (text ? text : "").replace(/["=<>\{\}\[\]\\\/]/gi, ' ');
                    // escape single quotes
                    if (escape == true) {
                        cleanText = cleanText.replace(/[']/g, '\\$&').replace(/\u0000/g, '\\0');
                    }
                    return cleanText;
                }

                function removeSpecialChars(string) {
                    return string.replace(/[`~!@#$%^&*()_|+=?;:,.<>\{\}\[\]\\\/]/gi, '');
                }

                function validateKeyword() {
                    if ($scope.Keyword === "" || $scope.Keyword == null) {
                        $scope.errorMsg = "Keyword is required!";
                        return false;
                    }

                    if ($scope.Keyword.length > 250) {
                        $scope.errorMsg = "Keyword is invalid!";
                        return false;
                    }

                    if ($scope.Keyword.indexOf(",") > -1 || $scope.Keyword.indexOf(";") > -1) {
                        $scope.errorMsg = "We accept only one keyword. Please do not use separator special chars , or ; ";
                        return false;
                    }

                    return true;
                }

                $scope.displaySearchVolume = function (volume) {
                    if (volume < 50) {
                        return "< 50";
                    }
                    return volume;
                };

                $scope.submitSearchKeyword = function () {
                    $scope.errorMsg = null;

                    if (hasCredits()) {

                        if (!validateKeyword()) {
                            console.warning($scope.errorMsg, {
                                closeButton: true,
                                timeOut: 3000
                            });
                            return;
                        }

                        keywordService.searchKeyword($j.trim(cleanKeyword(removeSpecialChars($scope.Keyword))), $scope.searchModel.selectedSource.Value, $scope.localLanguageCode, 10).then(
                            function loaded(results) {

                                setTimeout(function () {
                                    $j('body').animate({
                                        scrollTop: $j("#score-analysis-area").offset().top
                                    }, 1000);
                                });

                                $scope.searchModel.SearchResults = mapKeywordScores(results);

                                $scope.inputKeywordResult = _.find(results, function (item) {
                                    return item.Selected == true;
                                });

                            }, function (message) {
                                console.warning("You have used all your available keyword search credits.", message);
                            }
                        );
                    } else {
                        console.warning("You have used all your available keyword search credits.", "Credits below limit.");
                    }
                };

                $scope.selectKeywordSource = function (keywordSource) {
                    $scope.searchModel.selectedSource = keywordSource;
                    $cookieStore.put('wtt_keyword_source_lang', keywordSource.Value);
                };

                $scope.GetUrl = function () {
                    var previewUrl = pageObject.domainUrl + "umbraco/dialogs/Preview.aspx?id=" + contentId;   //pageObject.domainUrl + contentId + ".aspx"; //this doesn't work with Unpublished content.

                    if (pageObject.pagePublished !== false) {
                        $scope.permalink = pageObject.pageUrl.replace(/-/g, ' ');        
                        return pageObject.pageUrl;
                    }

                    $scope.permalink = previewUrl.replace(/-/g, ' ');        
                    return previewUrl;
                };                

                var getLiveContent = function (url) {
                    var deffered = $q.defer();

                    $j.ajax({
                        url: url,
                        type: 'GET',
                        success: function (result) {
                            deffered.resolve(result);
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            deffered.reject(errorThrown);
                            console.log(JSON.stringify(jqXHR));
                            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
                        }
                    });
                    return deffered.promise;
                };

                function replaceLineBreaks(str) {
                    return str.replace(/(?:\r\n|\r|\n)/g, '');
                }

                $scope.renderWttContainer = function () {
                    var div = document.createElement('div');
                    div.id = 'Webtexttool_container';
                    Object.assign(div.style,
                        {
                            position: 'fixed',
                            top: '0',
                            right: '0',
                            height: '100%',
                            zIndex: '7400',
                            width: '350px',
                            background: '#fff',
                            border: '1px solid rgba(199, 199, 199, 0.5)'
                        });
                    if ($j('.umb-editor-wrapper').find("#Webtexttool_container").length <= 0) {
                        $j('.umb-editor-wrapper').append(div);
                        $j('#Webtexttool_container').html($compile('<div ng-include="\'/App_Plugins/Webtexttool/partials/wtt_blocksuggestions.html\'"></div>')($scope));
                    }

                    $j('#Webtexttool_container').html($compile('<div ng-include="\'/App_Plugins/Webtexttool/partials/wtt_blocksuggestions.html\'"></div>')($scope));

                    return div;
                };

                $scope.compileWttContainer = function () {
                    $j('#Webtexttool_container').html($compile('<div ng-include="\'/App_Plugins/Webtexttool/partials/wtt_blocksuggestions.html\'"></div>')($scope));
                };

                $scope.useMyKeyword = function () {
                    var headerName = document.getElementsByClassName("umb-panel-header-name-input");
                    if (headerName.length > 0) {
                        $scope.Title = headerName[0].value;
                    }

                    getLiveContent($scope.GetUrl()).then(function (response) {

                        var mainRegExp = new RegExp(/^.*?<main[^>]*>(.*?)<\/main>.*?$/);

                        if (mainRegExp.test(replaceLineBreaks(response))) {
//                            console.log("HTML Content: ", replaceLineBreaks(response).replace(mainRegExp, '$1'));
                            $scope.HtmlContent = replaceLineBreaks(response).replace(mainRegExp, '$1');
                        } else {
//                            console.log("HTML Content: ", replaceLineBreaks(response).replace(/^.*?<body[^>]*>(.*?)<\/body>.*?$/g, '$1'));
                            $scope.HtmlContent = replaceLineBreaks(response).replace(/^.*?<body[^>]*>(.*?)<\/body>.*?$/g, '$1');
                        }

                        getHtmlAndRunSuggestions();

                        setTimeout(function () {
                            $scope.isCollapsed = true;
                        }, 500);
                    }, function (result) {
                        console.error(result);
                    });
                };

                if ((window.location.href.indexOf(edit_content_url) > -1 && window.location.href.indexOf(login_url)) <= -1) {
                    $scope.renderWttContainer();
                }               

                if (typeof wttGlobals !== "undefined") {
                    if (wttGlobals.Keywords !== "") {
                        $scope.useMyKeyword();
                    }
                }                

                /**
                 * Content Quality module implementation - contentQualityController.js
                 */
                $scope.updateSuggestionsStart = function () {
                    setInterval(function () {
                        $scope.runSuggestions();
                    }, $scope.runRulesTimeout);
                };

                $scope.rulesRunning = false;
                var suggestionsRanFirstTime = false;

                $scope.seoClass = "page-score";
                $scope.contentClass = "gray-score";

                $scope.pageScoreChartOptions = {
                    segmentShowStroke: false,
                    showTooltips: false,
                    cutoutPercentage: 70,
                    responsive: true,
                    maintainAspectRatio: false,
                    animateRotate: false
                };

                var buildActiveChart = function (score) {
                    return {
                        datasets: [
                            {
                                borderColor: ["#5cb85c", "#cee9ce"],
                                data: [score, 100 - score],
                                backgroundColor: ["#5cb85c", "#eee"]
                            }
                        ]
                    };
                };

                var buildInactiveChart = function (score) {
                    return {
                        datasets: [
                            {
                                borderColor: ["#D5D5D5", "#D5D5D5"],
                                data: [score, 100 - score],
                                backgroundColor: ["#D5D5D5", "#eee"]
                            }
                        ]
                    };
                };

                function isNullOrEmpty(str) {
                    return (str ? str : "").trim().length === 0;
                }

                $scope.analyze = function () {
                    var minValue = 1;

                    if (isNullOrEmpty($scope.HtmlContent)) {
                        console.error("Content is required");
                        return;
                    }

                    if ($scope.userInfo.Features.indexOf("ContentQuality") >= 0 && $scope.userInfo.Credits >= minValue) {

                        // update page settings QualityLevels
                        $scope.QualityLevels = $scope.settings;
                        
                        saveContentQualitySettings($scope.QualityLevels);

                        analyzeContentQuality(20);
                    } else {
                        alert("Oops.. You can't do this now. This might not be included in your current Textmetrics plan or you have run out of credits for this month.");
                    }
                };

                function getPageContent() {
                    var content = $scope.HtmlContent;
                    return content;
                }

                $scope.data = stateService.data;

                $scope.data.Resources.forEach(function (el, i) {
                    $scope.data.Resources[el.ResourceKey] = $sanitize(el.HtmlContent);
                });

                $scope.showReadingLevelHelp = $scope.data.Resources['LanguageLevelHelp'].toString();

                function analyzeContentQuality(ruleSet) {

                    // console.log("contentQualityController -> run Content Suggestions");

                    $scope.analyzing = true;
                    startContentQualityCompute();

                    $scope.cqModel = {
                        content: getPageContent(),
                        languageCode: $scope.localLanguageCode,
                        qualityLevels: $scope.settings,
                        ruleSet: ruleSet
                    };

                    // get content quality suggestions
                    httpService.postData(wttApiBaseUrl + "contentquality/suggestions", $scope.cqModel).then(function (response) {
                        endContentQualityCompute();

                        $scope.userInfo.Credits = $scope.userInfo.Credits - 1;

                        renderSuggestions(response.Suggestions);

                        saveContentQualitySuggestions(response); 
                        //$j.extend({}, response.Details, response.Suggestions)

                        // update run date
                        $scope.LastQualityRun = response.ModifiedDate;
                        $scope.LastModified = response.ModifiedDate;

                        // save details
                        $scope.contentQualityDetails = response.Details;

                        $scope.compileWttContainer();

                    }, function error(errorKey) {
                        console.error($scope.data.Resources[errorKey].toString());

                        // end analyze animations
                        showError($scope.data.Resources[errorKey].toString());
                        $scope.analyzing = false;
                    });
                }

                var saveContentQualitySuggestions = function (suggestions) {
                    var deffered = $q.defer();

                    var details = {
                        "Details": {
                            "ReadingLevel": suggestions.Details.ReadingLevel,
                            "ReadingTime": suggestions.Details.ReadingTime,
                            "ReadingValues": suggestions.Details.ReadingValues
                        }
                    };

                    var data = $j.extend({}, details, suggestions.Suggestions);

                    $j.ajax({
                        url: "backoffice/Webtexttool/Content/SaveSuggestions",
                        type: 'POST',
                        dataType: 'json',
                        data: {
                            ContentId: contentId,
                            ContentQualitySuggestions: JSON.stringify(data)
                        }, success: function (result) {
                            deffered.resolve(result);
                        }, error: function (jqXHR, textStatus, errorThrown) {
                            console.log(JSON.stringify(jqXHR));
                            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
                        }
                    });

                    return deffered.promise;
                };

                var saveContentQualitySettings = function (settings) {
                    var deffered = $q.defer();
            
                    $j.ajax({
                        url: "backoffice/Webtexttool/Content/SaveSettings",
                        type: 'POST',
                        dataType: 'json',
                        data: {
                            ContentId: contentId,
                            ContentQualitySettings: JSON.stringify(settings)
                        }, success: function (result) {
                            deffered.resolve(result);
                        }, error: function (jqXHR, textStatus, errorThrown) {
                            console.log(JSON.stringify(jqXHR));
                            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
                        }
                    });

                    return deffered.promise;
                };

                function renderSuggestions(response, broadcast) {
                    $scope.contentQualitySuggestions = response.Suggestions;
                    $scope.QualityScore = response.PageScore;
                    $scope.QualityScoreTag = response.PageScoreTag;
                    $scope.analyzing = false;

                    if (broadcast === false) {
                        return;
                    }
                    $scope.$broadcast('runSuggestions', { engine: "content" });
                }

                function startContentQualityCompute() {
                    $scope.QualityScore = ".";
                    $scope.QualityScoreTag = "Analyzing...";
                    $scope.loadingStep = 0;
                    $scope.$broadcast('runSuggestions', { engine: "loading" });
                    $scope.contentQualityLoading = true;
                }

                function endContentQualityCompute() {
                    $scope.contentQualityLoading = false;
                }

                function showError(error) {
                    $scope.contentQualityLoading = false;
                    $scope.$broadcast('runSuggestions', { engine: "error", error: error });
                }

                var escapeHtml = function (text) {
                    var map = {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#039;'
                    };

                    return text.toString().replace(/[&<>"']/g, function (m) {
                        return map[m];
                    });
                };
                
                $scope.runSuggestions = function () {
                    if ($scope.runRules == true && !$scope.rulesRunning) {

                        $scope.rulesRunning = true;

                        var content = getHtmlContent($scope.HtmlContent, $scope.Title, $scope.Description ? escapeHtml($scope.Description) : "", $scope.permalink, $scope.Keyword);
                        
                        var wttModel = {
                            content: content,
                            keywords: $scope.Keyword,
                            languageCode: $scope.localLanguageCode,
                            domain: $scope.domainUrl,
                            synonyms: $scope.pageKeywordSynonyms,
                            ruleSet: $scope.ruleSet,
                            smartSearch: true
                        };

                        httpService.postData(wttApiBaseUrl + "page/suggestions", wttModel).then(function (response) {

                            if (!suggestionsRanFirstTime) {
                                $scope.suggestions = response.Suggestions;
                                suggestionsRanFirstTime = true;
                            } else {
                                var updatedSuggestions = response.Suggestions;
                                _.each($scope.suggestions, function (suggestion, index) {
                                    suggestion.Tag = updatedSuggestions[index].Tag;
                                    suggestion.Importance = updatedSuggestions[index].Importance;
                                    suggestion.Penalty = updatedSuggestions[index].Penalty;
                                    suggestion.Rules = updatedSuggestions[index].Rules;
                                    suggestion.Score = updatedSuggestions[index].Score;
                                    suggestionsService.computeDisplayType(suggestion);
                                });

                            }

                            $scope.Score = response.PageScore;
                            $scope.ScoreTag = response.PageScoreTag;
                            $scope.runRules = false;
                            $scope.rulesRunning = false;
                            $scope.updateSuggestionsStart();

                            setTimeout(function () { broadcastSelectedNodes(); });

                            $scope.$broadcast('runSuggestions', { engine: $scope.activeEngine });
                        });
                    }
                };

                $scope.selectEngine = function (engine) {
                    $scope.activeEngine = engine;
                    $scope.$broadcast('runSuggestions', { engine: engine });
                };

                $scope.updateSuggestions = function () {
                    $scope.runRules = true;
                };

                $scope.$on("runSuggestions", function (event, args) {
                    // console.log(args);

                    $scope.loading = false;
                    $scope.showScore = true;
                    $scope.showError = false;
                    $scope.seoScoreTag = $scope.ScoreTag;
                    $scope.contentScoreTag = $scope.QualityScoreTag;
                    $scope.seoScore = $scope.Score || 0;
                    $scope.contentScore = $scope.QualityScore || 0;

                    if (args.engine == "seo") {
                        $scope.seoClass = "page-score";
                        $scope.contentClass = "gray-score";

                        setTimeout(function () {
                            $scope.seoPageScoreData = buildActiveChart(parseInt($scope.seoScore));
                            $scope.contentPageScoreData = buildInactiveChart(parseInt($scope.contentScore));
                        }, 0);                        
                    } else if (args.engine == "content") {
                        $scope.seoClass = "gray-score";
                        $scope.contentClass = "page-score";

                        setTimeout(function () {
                            $scope.seoPageScoreData = buildInactiveChart(parseInt($scope.seoScore));
                            $scope.contentPageScoreData = buildActiveChart(parseInt($scope.contentScore));
                        }, 0);                        
                    } else if (args.engine == "loading") {
                        $scope.showScore = false;
                        $scope.loading = true;
                        $scope.scoreTag = ".";
                        $scope.primaryScore = "Analyzing...";
                        $scope.secondaryScore = ".";
                    } else if (args.engine == "error") {
                        $scope.scoreTag = ".";
                        $scope.primaryScore = "Analyzing...";
                        $scope.secondaryScore = ".";
                        $scope.error = args.error;
                        $scope.showError = true;
                        $scope.showScore = false;
                        $scope.loading = false;
                    }
                });


                var broadcastSelectedNodes = function () {
                    $scope.$broadcast('WttPageController:selectNodes', selectedPageNodes);
                };

                var broadcastZeroNodes = function () {
                    var broadcastZeroDeferred = $q.defer();
                    selectedPageNodes = [];
                    $scope.$broadcast('WttPageController:selectNodes', selectedPageNodes);
                    broadcastZeroDeferred.resolve();
                    return broadcastZeroDeferred.promise;
                };

                $j(".umb-panel-header-name-input").focus(function () {
                    broadcastZeroNodes().then(function () {
                        selectedPageNodes = ['TITLE'];
                        broadcastSelectedNodes();
                    });
                });

                $j(".umb-panel-header-name-input").blur(function () {
                    broadcastZeroNodes();
                });

                $j("#wttDescription").focus(function () {
                    broadcastZeroNodes().then(function () {
                        selectedPageNodes = ['DESCRIPTION'];
                        broadcastSelectedNodes();
                    });
                });

                $j("#wttDescription").blur(function () {
                    broadcastZeroNodes();
                });
                
                var headerName = document.getElementsByClassName("umb-panel-header-name-input");
                if (headerName.length > 0) {
                    $scope.Title = headerName[0].value;
                }

                $j(".umb-panel-header-name-input").keyup(function () {
                    $scope.Title = $j(this).val();

                    if ($scope.Title !== null) {
                        $scope.updateSuggestions();
                    }
                });
               
                $scope.keywordChange = function () {
                    if (contentId === 0) {
                        $j("#wtt-keyword").val('');
                        if($j('#keyword_error').length <= 0) {
                            $j("#keyword-suggestion-button").prepend("<p id='keyword_error' style='color: #ea930b;'><strong>Save the page before entering a keyword!</strong></p>");
                        }                       
                    }

                    $scope.Keyword = $j("#wtt-keyword").val();
                };

                $scope.descriptionChange = function () {
                    if (contentId === 0) {
                        $j("#wttDescription").val('');
                        if ($j('#description_error').length <= 0) {
                            $j("#descriptiondiv").append("<p id='description_error' style='color: #ea930b;'><strong>Save the page before entering a description!</strong></p>");
                        }
                    }

                    setTimeout(function () {
                        $scope.updateSuggestions();
                    }, 1000);
                };                

                $scope.useRelatedKeyword = function (keyword) {
                    if ($scope.pageHasKeyword()) {
                        $scope.Keyword = keyword.Keyword;
                        var headerName = document.getElementsByClassName("umb-panel-header-name-input");
                        if (headerName.length > 0) {
                            $scope.Title = headerName[0].value;
                        }                        

                        getLiveContent($scope.GetUrl()).then(function (response) {
                            var mainRegExp = new RegExp(/^.*?<main[^>]*>(.*?)<\/main>.*?$/);

                            if (mainRegExp.test(replaceLineBreaks(response))) {
//                                console.log("HTML Content: ", replaceLineBreaks(response).replace(mainRegExp, '$1'));
                                $scope.HtmlContent = replaceLineBreaks(response).replace(mainRegExp, '$1');
                            } else {
//                                console.log("HTML Content: ", replaceLineBreaks(response).replace(/^.*?<body[^>]*>(.*?)<\/body>.*?$/g, '$1'));
                                $scope.HtmlContent = replaceLineBreaks(response).replace(/^.*?<body[^>]*>(.*?)<\/body>.*?$/g, '$1');
                            }

                            getHtmlAndRunSuggestions();

                            setTimeout(function () {
                                $scope.isCollapsed = true;
                            }, 500);
                        },
                            function (result) {
                                console.error(result);
                            });
                    }
                };

                

                var initialCqTemplate = {
                    "PageScore": 0.0,
                    "Suggestions": [{
                        "Tag": "Readability",
                        "MetaTag": "Readability",
                        "Rules": null,
                        "Importance": 70.0,
                        "Score": 0.0,
                        "Penalty": 0.0,
                        "Tooltip": null,
                        "SortIndex": 1,
                        "Metadata": {
                            "Category": 20,
                            "ShortName": "Readability",
                            "DisplayName": "Readability",
                            "DisplayType": null,
                            "Order": 1,
                            "Settings": [{ "DisplayName": "Elementary", "Value": "1" }, {
                                "DisplayName": "Highschool",
                                "Value": "2"
                            }, { "DisplayName": "University", "Value": "3" }],
                            "Rules": [{
                                "Name": "ReadingLevel",
                                "Value": "1",
                                "IsPrimary": true,
                                "IsStringValue": false
                            }, {
                                "Name": "DifficultWordsLevel",
                                "Value": "1",
                                "IsPrimary": false,
                                "IsStringValue": false
                            }, {
                                "Name": "LongSentencesLevel",
                                "Value": "1",
                                "IsPrimary": false,
                                "IsStringValue": false
                            }, {
                                "Name": "SentenceLengthLevel",
                                "Value": "1",
                                "IsPrimary": false,
                                "IsStringValue": false
                            }, {
                                "Name": "PassiveVoice",
                                "Value": "1",
                                "IsPrimary": false,
                                "IsStringValue": false
                            }, {
                                "Name": "DifficultWordsLevel",
                                "Value": "1",
                                "IsPrimary": false,
                                "IsStringValue": false
                            }]
                        }
                    }, {
                        "Tag": "Adjectives",
                        "MetaTag": "Adjectives",
                        "Rules": null,
                        "Importance": 20.0,
                        "Score": 0.0,
                        "Penalty": 0.0,
                        "Tooltip": null,
                        "SortIndex": 1,
                        "Metadata": {
                            "Category": 21,
                            "ShortName": "Adjectives",
                            "DisplayName": "Adjectives",
                            "DisplayType": null,
                            "Order": 2,
                            "Settings": null,
                            "Rules": [{
                                "Name": "AdjectivesLevel",
                                "Value": "1",
                                "IsPrimary": true,
                                "IsStringValue": false
                            }]
                        }
                    }, {
                        "Tag": "Whitespaces",
                        "MetaTag": "Whitespaces",
                        "Rules": null,
                        "Importance": 20.0,
                        "Score": 0.0,
                        "Penalty": 0.0,
                        "Tooltip": null,
                        "SortIndex": 1,
                        "Metadata": {
                            "Category": 23,
                            "ShortName": "Whitespaces",
                            "DisplayName": "Whitespaces",
                            "DisplayType": null,
                            "Order": 5,
                            "Settings": null,
                            "Rules": [{
                                "Name": "WhitespacesLevel",
                                "Value": "1",
                                "IsPrimary": true,
                                "IsStringValue": false
                            }, {
                                "Name": "BulletPointsLevel",
                                "Value": "1",
                                "IsPrimary": false,
                                "IsStringValue": false
                            }]
                        }
                    }, {
                        "Tag": "Gender",
                        "MetaTag": "Gender",
                        "Rules": null,
                        "Importance": 15.0,
                        "Score": 0.0,
                        "Penalty": 0.0,
                        "Tooltip": null,
                        "SortIndex": 1,
                        "Metadata": {
                            "Category": 22,
                            "ShortName": "Gender",
                            "DisplayName": "Gender",
                            "DisplayType": null,
                            "Order": 3,
                            "Settings": [{ "DisplayName": "Female", "Value": "f" }, {
                                "DisplayName": "Neutral",
                                "Value": "n"
                            }, { "DisplayName": "Male", "Value": "m" }],
                            "Rules": [{
                                "Name": "GenderLevel",
                                "Value": "n",
                                "IsPrimary": true,
                                "IsStringValue": true
                            }]
                        }
                    }, {
                        "Tag": "Sentiment",
                        "MetaTag": "Sentiment",
                        "Rules": null,
                        "Importance": 10.0,
                        "Score": 0.0,
                        "Penalty": 0.0,
                        "Tooltip": null,
                        "SortIndex": 1,
                        "Metadata": {
                            "Category": 30,
                            "ShortName": "Sentiment",
                            "DisplayName": "Sentiment",
                            "DisplayType": null,
                            "Order": 4,
                            "Settings": [{
                                "DisplayName": "Negative",
                                "Value": "negative"
                            }, { "DisplayName": "Neutral", "Value": "neutral" }, {
                                "DisplayName": "Positive",
                                "Value": "positive"
                            }],
                            "Rules": [{
                                "Name": "SentimentLevel",
                                "Value": "positive",
                                "IsPrimary": true,
                                "IsStringValue": true
                            }]
                        }
                    }],
                    "PageScoreTag": "Let’s get started!",
                    "RuleSet": "ContentQuality"
                }

                function getDefaultQualitySettings() {
                    return {
                        ReadingLevel: "1",
                        DifficultWordsLevel: 1,
                        LongSentencesLevel: 1,
                        AdjectivesLevel: 1,
                        WhitespacesLevel: 1,
                        BulletPointsLevel: 1,
                        ImagesLevel: 1,
                        GenderLevel: 'n',
                        SentimentLevel: 'neutral',

                        GenderList: 1,
                        JargonList: 1,
                        SingularPluralLevel: 1,
                        RepetitionLevel: 1,
                        TextLengthRuleLevel: 1
                    };
                }

                function init() {
                    loadKeywordSources();
                    loadLanguages();

                    if ((window.location.href.indexOf(edit_content_url) > -1 && window.location.href.indexOf(login_url)) <= -1) {
                        $j('.umb-panel.umb-editor-wrapper').each(function () {
                            this.style.setProperty('right', '350px', 'important');
                        });
                    }                    

                    $scope.QualityLevels = '';
                    if (typeof wttGlobals !== "undefined") {
                        if (wttGlobals.ContentQualitySettings !== "") {
                            $scope.QualityLevels = JSON.parse(wttGlobals.ContentQualitySettings);
                        }
                    }

                    // get page quality levels from settings
                    if ($scope.QualityLevels) {
                        $scope.settings = $scope.QualityLevels;
                    } else {
                        $scope.settings = getDefaultQualitySettings();
                    }

                    if (typeof wttGlobals !== "undefined" && wttGlobals.ContentQualitySuggestions !== null) {
                        // load last run suggestions
                        var lastRunSuggestions = JSON.parse(wttGlobals.ContentQualitySuggestions);
                        $scope.contentQualityDetails = lastRunSuggestions.Details;

                        renderSuggestions(lastRunSuggestions, false);
                    } else {
                        // load initial template
                        $scope.contentQualitySuggestions = initialCqTemplate.Suggestions;
                        $scope.QualityScoreTag = initialCqTemplate.Suggestions.PageScoreTag;
                    }

                }

                init();

                // Language service
                function loadLanguages() {
                    languageService.getLanguages().then(
                        function loaded(languages) {
                            $scope.languages = languages;
                        });
                }

                $scope.activeLanguageCode = languageService.getActiveLanguageCode();

                $scope.$on('userLanguageChanged', function () {
                    $scope.activeLanguageCode = languageService.getActiveLanguageCode();
                });

                var updateUserLanguage = function (languageCode) {
                    httpService.postData(wttApiBaseUrl + "user/language/" + languageCode).then(function () {
                        $scope.localLanguageCode = languageCode;

                        $scope.$broadcast('languageChanged');

                        $scope.useMyKeyword();
                    });
                };

                $scope.setActiveLanguage = function (language) {
                    $scope.activeLanguageCode = language.LanguageCode;
                    updateUserLanguage(language.LanguageCode);
                };



            });
        }
    });
}]);

app.factory("suggestionsService", function () {
    var computeDisplayType = function (suggestion) {
        suggestion.displayScore = suggestion.Score == 0 ? suggestion.Importance * 0.2 : suggestion.Score;
        suggestion.progressType = suggestion.Score < suggestion.Importance / 3 ? "danger" :
            suggestion.Score < suggestion.Importance ? "warning" : "success";
    };

    return {
        computeDisplayType: computeDisplayType
    };
});

app.factory("synonymService", ['$q', 'httpService',
    function ($q, httpService) {
        var getSynonyms = function (word) {
            var dataUrl = api_base_url + "synonyms/" + encodeURI(word);
            var deffered = $q.defer();
            httpService.getData(dataUrl).then(function (synonyms) {
                deffered.resolve(synonyms);
            });
            return deffered.promise;
        };

        return {
            getSynonyms: getSynonyms
        }
    }
]);

app.filter("boolText", function () {
    return function (boolValue) {
        if (boolValue === "true" || boolValue === true)
            return true;
        else {
            return false;
        }
    }
});

angular.module('umbraco.directives').directive("wttPageSlideout", function () {
    return {
        templateUrl: "../App_Plugins/Webtexttool/partials/directives/wtt-page-slideout.html",
        scope: {
            info: "="
        },
        restrict: "E",
        replace: true,
        link: function () {            
        }
    };
});

angular.module('umbraco.directives').directive("wttContentQuality", function () {
    return {
        templateUrl: "../App_Plugins/Webtexttool/partials/directives/wtt-content-quality.html",
        restrict: 'E',
        link: function () {           
        }
    };
});

angular.module('umbraco.directives').directive('wttSuggestion', ["suggestionsService", "stateService", "$sanitize", function (suggestionsService, stateService, $sanitize) {
    return {
        templateUrl: "../App_Plugins/Webtexttool/partials/directives/wtt-suggestion.html",
        scope: {
            suggestion: '=',
            uid: '=',
            index: '@'
        },
        restrict: 'E',
        replace: true,
        link: function (scope) {
            scope.suggestion.selected = false;
            scope.suggestion.isCollapsed = true;
            suggestionsService.computeDisplayType(scope.suggestion);            

            var data = stateService.data;
            scope.data = data;
            data.viewExtraInfoToggle = {};
            scope.sliderInfo = {};


            scope.$watch('suggestion.Rules', function (suggestion) {
                // console.log('update suggestions');
                _.each(suggestion.Rules, function (rule) {
                    if (scope.data.viewExtraInfoToggle[rule.Text]) {
                        // console.log('update rule: ' + rule);
                        scope.processSliderInfo(rule);
                    }
                });
            }, true);

            var tagMap = {
                'Page Title': ['TITLE'],
                'Page Description': ['DESCRIPTION'],
                'Headings': ['HEADINGS'],
                'Main Content': ['MAINCONTENT'],
                'Miscellaneous': ['MISCELLANEOUS']
            };

            var suggestionTags = tagMap[scope.suggestion.Tag];

            scope.viewExtraInfoList = function (rule) {
                if (scope.data.viewExtraInfoToggle[rule.Text] == null || scope.data.viewExtraInfoToggle[rule.Text] === true) {
                    Object.keys(scope.data.viewExtraInfoToggle).forEach(function (ruleText, index) {
                        scope.data.viewExtraInfoToggle[ruleText] = true;
                    });

                    scope.data.viewExtraInfoToggle[rule.Text] = false;
                } else {
                    scope.data.viewExtraInfoToggle[rule.Text] = true;
                    return;
                }

                if (scope.sliderInfo[rule.Text] != null) {
                    return;
                }

                scope.processSliderInfo(rule);
            };

            scope.$on('WttPageController:selectNodes', function (event, selectedNodeNames) {
                if (selectedNodeNames.length === 0) {
                    scope.suggestion.selected = false;
                    if (scope.suggestion.Score == scope.suggestion.Importance) {
                        scope.suggestion.isCollapsed = true;
                    }
                } else {

                    // title or description collapse behaviour
                    if (_.contains(selectedNodeNames, 'TITLE') || _.contains(selectedNodeNames, 'DESCRIPTION')) {
                        scope.suggestion.isCollapsed = true;
                        if (_.contains(selectedNodeNames, 'TITLE') && scope.suggestion.Tag == 'Page Title' && scope.suggestion.Score !== scope.suggestion.Importance) {
                            scope.suggestion.isCollapsed = false;
                        }
                        if (_.contains(selectedNodeNames, 'DESCRIPTION') && scope.suggestion.Tag == 'Page Description' && scope.suggestion.Score !== scope.suggestion.Importance) {
                            scope.suggestion.isCollapsed = false;
                        }
                    } else {

                        // body nodes collapse behaviour
                        if (scope.suggestion.Tag == 'Page Title' || scope.suggestion.Tag == 'Page Description') {
                            scope.suggestion.isCollapsed = true;
                        } else {
                            if (scope.suggestion.Score !== scope.suggestion.Importance) {
                                scope.suggestion.isCollapsed = false;
                            }
                        }
                    }

                    // selection behaviour
                    _.each(suggestionTags, function (suggestionTag) {
                        if (_.contains(selectedNodeNames, suggestionTag)) {
                            scope.suggestion.selected = true;
                            scope.suggestion.isCollapsed = false;
                            return;
                        }
                    });
                }
            });

            function camelize(str) {
                return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (match, index) {
                    if (+match === 0) return "";
                    return index == 0 ? match.toLowerCase() : match.toUpperCase();
                });
            }

            data.Resources.forEach(function (el, i) {
                data.Resources[el.ResourceKey] = $sanitize(el.HtmlContent);
            });

            var setDisplayTexts = function () {
                var resourceName = scope.suggestion.Tag.replace(new RegExp(" ", "g"), "") + "Label";
                scope.displayName = data.Resources[resourceName].toString();

                scope.name = scope.suggestion.Tag.replace(new RegExp(" ", 'g'), "") + 'Suggestion';
                scope.tip = data.Resources[scope.name];

                scope.domId = camelize(scope.suggestion.Tag) + 'SuggestionBox';
            };

            setDisplayTexts();

            scope.processTags = function (localSliderInfo) {
                return _.map(localSliderInfo.List, function (item) {
                    return {
                        word: item.word,
                        count: item.count,
                        type: item.type || 'blue',
                        dataSource: item.to && item.to.length > 0 ? item.to : null,
                        tip: item.to ? item.to.map(function (ds) { return ds.word; }).join(", ") : '',
                        suppressIgnore: localSliderInfo.SuppressIgnore
                    };
                });
            };

            scope.processSliderInfo = function (rule) {
                scope.sliderInfo[rule.Text] = JSON.parse(rule.ExtraInfo);
                var localSliderInfo = scope.sliderInfo[rule.Text];
                localSliderInfo.tags = localSliderInfo.List;

                if (localSliderInfo.Type == "info") {
                    localSliderInfo.tags = scope.processTags(localSliderInfo);
                    return localSliderInfo;
                }

                return localSliderInfo;
            };
        }
    };
}]);

angular.module("umbraco.directives").directive("wttSuggestionContentQuality", ["suggestionsService", "stateService", "$sanitize",
    function (suggestionsService, stateService, $sanitize) {
        return {
            templateUrl: "../App_Plugins/Webtexttool/partials/directives/wtt-suggestion-content-quality.html",
            scope: {
                settings: "=",
                suggestion: "=",
                uid: "=",
                index: "@"
            },
            restrict: 'E',
            replace: true,
            link: function (scope, elem, attr) {
                var updateOnAction = function (value) {
                    scope.suggestion.selected = (value != 0);
                };

                var data = stateService.data;
                data.viewExtraInfoToggle = {};
                scope.sliderInfo = {};
                scope.data = data;

                scope.setRuleProp = function (rules, value) {
                    for (var i = 0; i < rules.length; i++) {
                        var rule = rules[i];
                        var prop = rule.Name;
                        if (value === 0) {
                            if (scope.settings[prop]) {
                                scope.settings[prop] = rule.IsStringValue ? '' : 0;
                            } else {
                                scope.settings[prop] = rule.Value;
                            }
                        } else {
                            scope.settings[prop] = value;
                        }
                    }
                };

                var buildAction = function (metadata) {
                    // console.log(metadata);

                    var primaryRule = metadata.Rules[0];
                    var prop = primaryRule.Name;
                    var buttonList = _.map(metadata.Settings, function (item) {
                        return {
                            label: item.DisplayName,
                            tip: item.DisplayName,
                            value: item.Value
                        };
                    });

                    return {
                        buttons: buttonList,
                        action: function (button) {
                            scope.setRuleProp(metadata.Rules, button.value);
                            updateOnAction(scope.settings[prop]);
                        },
                        selected: function (button) {
                            return scope.settings[prop] == button.value;
                        },
                        active: !!scope.settings[prop],
                        display: metadata.DisplayType
                    }
                };

                var action = buildAction(scope.suggestion.Metadata);
                scope.actionConfig = action;

                scope.suggestion.selected = scope.suggestion.Importance > 0;
                scope.suggestion.isCollapsed = false;

                suggestionsService.computeDisplayType(scope.suggestion);

                var camelize = function (str) {
                    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (match, index) {
                        if (+match === 0) return "";
                        return index == 0 ? match.toLowerCase() : match.toUpperCase();
                    });
                }

                data.Resources.forEach(function (el, i) {
                    data.Resources[el.ResourceKey] = $sanitize(el.HtmlContent);
                });

                var setDisplayTexts = function () {
                    var resourceName = scope.suggestion.Tag.replace(new RegExp(" ", "g"), "") + "Label";
                    scope.displayName = data.Resources[resourceName].toString();

                    scope.name = scope.suggestion.Tag.replace(new RegExp(" ", 'g'), "") + 'Suggestion';
                    scope.tip = data.Resources[scope.name];

                    scope.domId = camelize(scope.suggestion.Tag) + 'SuggestionBox';
                };

                setDisplayTexts();

                scope.$on("languageChanged", setDisplayTexts);

                scope.viewExtraInfoList = function (rule) {
                    if (scope.data.viewExtraInfoToggle[rule.Text] == null || scope.data.viewExtraInfoToggle[rule.Text] === true) {
                        Object.keys(scope.data.viewExtraInfoToggle).forEach(function (ruleText, index) {
                            scope.data.viewExtraInfoToggle[ruleText] = true;
                        });

                        scope.data.viewExtraInfoToggle[rule.Text] = false;
                    } else {
                        scope.data.viewExtraInfoToggle[rule.Text] = true;
                    }

                    if (scope.sliderInfo[rule.Text] != null) {
                        return;
                    }

                    scope.processSliderInfo(rule);
                };

                scope.processTags = function (localSliderInfo) {
                    return _.map(localSliderInfo.List, function (item) {
                        return {
                            word: item.word,
                            count: item.count,
                            type: item.type || 'blue',
                            dataSource: item.to && item.to.length > 0 ? item.to : null,
                            tip: item.to ? item.to.map(function (ds) { return ds.word; }).join(", ") : '',
                            suppressIgnore: localSliderInfo.SuppressIgnore
                        };
                    });
                };

                scope.processSliderInfo = function (rule) {
                    scope.sliderInfo[rule.Text] = JSON.parse(rule.ExtraInfo);
                    var localSliderInfo = scope.sliderInfo[rule.Text];
                    localSliderInfo.tags = localSliderInfo.List;

                    if (localSliderInfo.Type == "info") {
                        localSliderInfo.tags = scope.processTags(localSliderInfo);
                        return localSliderInfo;
                    }

                    return localSliderInfo;
                };
            }
        };
    }]);

angular.module("umbraco.directives").directive("wttSuggestionInfo", function () {
    return {
        templateUrl: "../App_Plugins/Webtexttool/partials/directives/wtt-suggestion-info.html",
        scope: {
            rule: "=",
        },
        restrict: 'E',
        replace: true,
        link: function (scope) {
            scope.$watch('rule', function (rule) {
                scope.processRule(rule);
            }, true);

            scope.processTags = function (localSliderInfo) {
                return _.map(localSliderInfo.List, function (item) {
                    return {
                        word: item.word,
                        count: item.count,
                        type: item.type || 'blue',
                        dataSource: item.to && item.to.length > 0 ? item.to : null,
                        tip: item.to ? item.to.map(function (ds) { return ds.word; }).join(", ") : '',
                        suppressIgnore: localSliderInfo.SuppressIgnore
                    };
                });
            };

            scope.processRule = function (rule) {
                scope.info = JSON.parse(rule.ExtraInfo);
                var localSliderInfo = scope.info;
                localSliderInfo.tags = localSliderInfo.List;

                if (localSliderInfo.Type == "info") {
                    localSliderInfo.tags = scope.processTags(localSliderInfo);
                    return localSliderInfo;
                }

                return localSliderInfo;
            };
        }
    };
});

app.factory("languageService", ['httpService', '$cookieStore',
    function (httpService, $cookieStore) {        
        var getLanguages = function () {
            return httpService.getData(api_base_url + "languages");
        };

        var getActiveLanguageCode = function () {

            if (!_.isUndefined($cookieStore.get('wtt_lang'))) {
                return $cookieStore.get('wtt_lang');
            }

            var language = window.navigator.userLanguage || window.navigator.language;
            if (language.indexOf("nl") >= 0) {
                return "nl";
            }

            return "en";
        };

        return {
            getLanguages: getLanguages,
            getActiveLanguageCode: getActiveLanguageCode
        };
    }
]);

app.factory("keywordService", ['$q', 'httpService',
    function ($q, httpService) {
        var wttApiBaseUrl = api_base_url + 'keywords';

        var getKeywordSources = function () {
            return httpService.getData(wttApiBaseUrl + "/sources");
        };

        var searchKeyword = function (keyword, database, language) {
            var deffered = $q.defer();

            httpService.getData(wttApiBaseUrl + "/" + keyword + "/" + database + "/" + language)
                .then(function (results) {
                    deffered.resolve(results);
                }, function (results) {
                    return deffered.reject(results);
                });

            return deffered.promise;
        };

        return {
            getKeywordSources: getKeywordSources,
            searchKeyword: searchKeyword
        }
    }
]);

angular.module("umbraco").factory("httpService", ['$http', '$q',
    function ($http, $q) {

        var getData = function (url) {

            var deffered = $q.defer();

            // Make a get request
            $http.get(url, {
                withCredentials: true
            })
                .success(function (data, status, headers, config) {
                    deffered.resolve(data);
                }).error(function (error, status) {

                    if (status == 401) {
                        return;
                    }

                    deffered.reject(error.Message);
                });

            return deffered.promise;
        };


        var postData = function (url, dataIn) {

            var deffered = $q.defer();

            // Make a post request
            $http.post(url, dataIn, {
                withCredentials: true
            })
                .success(function (data, status, headers, config) {
                    deffered.resolve(data);
                }).error(function (error, status) {

                    if (status == 401) {
                        return;
                    }

                    deffered.reject(error.Message);
                });

            return deffered.promise;

        };

        return {
            getData: getData,
            postData: postData
        }
    }
]);

app.factory("stateService", [function () {
    var data = {
        Resources: [
            {
                "ResourceKey": "CQGenericError",
                "HtmlContent": "We're sorry, we could not analyze your content. Please try again or contact support@textmetrics.com in case the issues persist.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "ContentRequiredError",
                "HtmlContent": "Your page needs some content.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "ContentMinLengthError",
                "HtmlContent": "Your page content must have at least 150 words.",
                "LanguageCode": "en"
            },
            { "ResourceKey": "GenericError", "HtmlContent": "Something went wrong!", "LanguageCode": "en" },
            {
                "ResourceKey": "LanguageNotSupportedError",
                "HtmlContent": "Detected language is not yet supported!",
                "LanguageCode": "en"
            },
            { "ResourceKey": "PageTitleLabel", "HtmlContent": "Page Title", "LanguageCode": "en" },
            { "ResourceKey": "PageDescriptionLabel", "HtmlContent": "Page Description", "LanguageCode": "en" },
            { "ResourceKey": "HeadingsLabel", "HtmlContent": "Headings", "LanguageCode": "en" },
            { "ResourceKey": "MainContentLabel", "HtmlContent": "Main Content", "LanguageCode": "en" },
            { "ResourceKey": "MiscellaneousLabel", "HtmlContent": "Miscellaneous", "LanguageCode": "en" },
            {
                "ResourceKey": "HeadingsSuggestion",
                "HtmlContent": "To optimize your content both in terms of readability and SEO, you should structure your content by adding several headings. At the start of your page you normally have an H1 / heading 1 with the title of your page. In some CMS's / themes this H1 is added automatically. If this is the case, you can select the option \"Process page title as H1\" from the settings above. Next to H1, you should add smaller heading (H2-H6) to structure your content even further.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "MainContentSuggestion",
                "HtmlContent": "Here you will find several important suggestions for your content. Please have a look at our knowledgebase (Learn tab in the app) to find more background information about these suggestions.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "MiscellaneousSuggestion",
                "HtmlContent": "Here you will find suggestions to optimize your content. These will have smaller impact on overall optimization, but are good to consider and see if they can fit in your content.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "PageTitleSuggestion",
                "HtmlContent": "The Page title is important to search engines. And therefore it's important to you. Think of a catchy title that will trigger a user to click on your page when it's listed in the search results. Of course it should also cover the content of the page.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "PageDescriptionSuggestion",
                "HtmlContent": "The page description is important because it's shown in the search results and it will tell the search and the users what your page is about. So provide a good description of your content and make sure you follow the suggestion for creating a perfect description of your page.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "Heading1Suggestion",
                "HtmlContent": "A H1 / Header section at the beginning of your page is important because it's the readable introduction of your page. In some CMS's the Page Title is automatically inserted at the top of a page in H1/Header 1.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "Heading2to6Suggestion",
                "HtmlContent": "Use smaller headings (h2, h3, h4, h5 and/or h6) in your content to highlight / summarize paragraphs. Using headers will make it easier for you reader to \"scan\" the contents of your page. It allows you to catch the reader's attention.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "BodySuggestion",
                "HtmlContent": "These suggestions are related to overall content on your page. Our rules suggest a minimum number of words for your page. Also related to the length of your content, is the number of times you should use your keywords. This way you can avoid to put your keyword too many times in the content (\"keyword stuffing\"), but also make sure that you use your keyword enough times so it will be clear for the search engine what the content is about.",
                "LanguageCode": "en"
            },
            { "ResourceKey": "PageLabel", "HtmlContent": "Page", "LanguageCode": "en" },
            { "ResourceKey": "SentimentLabel", "HtmlContent": "Sentiment", "LanguageCode": "en" },
            { "ResourceKey": "ReadabilityLabel", "HtmlContent": "Readability", "LanguageCode": "en" },
            { "ResourceKey": "AdjectivesLabel", "HtmlContent": "Text credibility", "LanguageCode": "en" },
            { "ResourceKey": "GenderLabel", "HtmlContent": "Target audience", "LanguageCode": "en" },
            { "ResourceKey": "WhitespacesLabel", "HtmlContent": "Text layout", "LanguageCode": "en" },
            { "ResourceKey": "BulletpointsLabel", "HtmlContent": "Bulletpoints", "LanguageCode": "en" },
            {
                "ResourceKey": "ReadabilitySuggestion",
                "HtmlContent": "Readability: multiple checks on complexity level of the content (reading score/long sentences/difficult words).",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "AdjectivesSuggestion",
                "HtmlContent": "Checks the use of adjectives in your text. Over- or underuse of adjectives will decrease effectiveness of your text.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "GenderSuggestion",
                "HtmlContent": "Gender check on level (confidence) of content target.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "SentimentSuggestion",
                "HtmlContent": "Set your desired sentiment and see if your content matches. If it doesn't match, it will show you which words to change.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "WhitespacesSuggestion",
                "HtmlContent": "Checks the use of white spaces in your content. Use this to make your content easier to scan and read.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "BulletpointsSuggestion",
                "HtmlContent": "Checks the use of bulletpoints in your content. Use these to make the text easier to scan and read.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "PageSuggestion",
                "HtmlContent": "Your content size is too big.",
                "LanguageCode": "en"
            },
            {
                "ResourceKey": "LanguageLevelHelp",
                "HtmlContent": "Basic User (A1, A2): A1 (Beginner), A2 (Elementary) | Independent User (B1, B2): B1 (Intermediate), B2 (Upper-Intermediate) | Proficient User (C1, C2): C1 (Advanced), C2 (Proficiency)",
                "LanguageCode": "en"
            }
        ],
        loading: false,
        showSpinner: true,
        languages: null,
        sliderInfo: null
    };

    var clear = function () {
        data.languages = null;
        data.sliderInfo = null;
    };

    return {
        data: data,
        clear: clear
    };
}]);