(function () {
    angular.module("umbraco").config(['$httpProvider', function ($httpProvider) {

        $httpProvider.interceptors.push(["$q", function ($q) {
            return {
                request: function (config) {
                    if (config.url.indexOf("api.webtexttool.com") > 0) {
                        config.headers = config.headers || {};
                        config.headers.Authorization = 'Bearer ' + localStorage.getItem('wtt_token');
                        config.headers.WttSource = 'Umbraco';
                    }
                    return config;
                },
                response: function (response) {
                    return response || $q.when(response);
                }
            };
        }]);
    }]);

    // Register the controller
    angular.module("umbraco").controller('WttDashboardController',
        function ($scope, $http, $q, assetsService, webtexttoolResource) {
//            assetsService.load(["/App_Plugins/Webtexttool/css/wtt-admin.css"], $scope);

            $scope.wttTemplates = [
                {
                    url: '/App_Plugins/Webtexttool/backoffice/webtexttooltree/wtt-account.html'
                },
                {
                    url: '/App_Plugins/Webtexttool/backoffice/webtexttooltree/wtt-login.html'
                }
            ];

            $scope.error = null;
            $scope.message = "Invalid Email or Password";
            $scope.loading = false;
            $scope.logo = "../App_Plugins/Webtexttool/images/logo_hd.png";
            $scope.promiseMessage = "Please wait...";
            var wttApiBaseUrl = "https://api.webtexttool.com/"; //wtt_admin_globals.wtt_base_api_url;
            $scope.WttAppUrl = "https://app.webtexttool.com/#/";
            $scope.apiKey = {
                value: ""
            };

            $scope.loginModel = {
                UserName: "",
                Password: "",
                RememberMe: true
            };

            var getData = function (url) {
                var deffered = $q.defer();

                $http.get(url,
                    {
                        withCredentials: true
                    })
                    .success(function (data, status, headers, config) {
                        deffered.resolve(data);
                    }).error(function (error, status) { // called asynchronously if an error occurs
                        deffered.reject(error.Message);
                    });
                return deffered.promise;
            };

            var postData = function (url, dataIn) {
                var deffered = $q.defer();

                $http.post(url,
                    dataIn,
                    {
                        withCredentials: true
                    })
                    .success(function (data, status, headers, config) {
                        deffered.resolve(data);
                    }).error(function (error, status) { // called asynchronously if an error occurs
                        deffered.reject(error.Message);
                        $scope.error = error.Message;
                        $scope.loading = false;
                    });
                return deffered.promise;
            };

            var saveDashboardData = function (data) {
                var deffered = $q.defer();
                
                jQuery.ajax({
                    url: 'backoffice/Webtexttool/Dashboard/Save',
                    type: 'POST',
                    dataType: 'json',
                    data: data,
                    success: function (result) {
                        deffered.resolve(result);
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.log(JSON.stringify(jqXHR));
                        console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
                    }
                });

                return deffered.promise;
            };

            $scope.saveApiKey = function () {                
                var data = {
                    apiKey: $scope.apiKey.value
                };

                localStorage.setItem('wtt_token', $scope.apiKey.value);

                saveDashboardData(data).then(function () {
                    window.location.reload();
                });
            };

            $scope.login = function () {
                $scope.loading = true;
               
                postData(wttApiBaseUrl + "user/login", $scope.loginModel).then(function(response) {
                    var data = {
                        accessToken: response.access_token
                    };

                    if (response) {
                        localStorage.setItem('wtt_token', response.access_token);                        

                        saveDashboardData(data).then(function () {
                            window.location.reload();
                        });
                    } else {
                        $scope.loading = false;
                        $scope.error = $scope.message;
                    }

                });
            };

            $scope.logout = function () {

                $scope.loading = true;

                getData(wttApiBaseUrl + "user/logout").then(function () {
                    localStorage.removeItem('wtt_token');

                    var data = {
                        apiKey: "",
                        accessToken: ""
                    };

                    saveDashboardData(data).then(function () {
                        window.location.reload();
                    });
                });
            };

            function init() {
                var apiKey;
                var authCode;

                webtexttoolResource.getWttData().then(function (response) {          
                    
                    apiKey = response.data.ApiKey;
                    authCode = response.data.AccessToken;
                   
                    if (localStorage.getItem('wtt_token') === null || localStorage.getItem('wtt_token') === "") {
                        if (authCode !== '') {
                            localStorage.setItem('wtt_token', authCode);
                            window.location.reload();
                        }

                        if (apiKey !== '') {
                            localStorage.setItem('wtt_token', apiKey);
                            window.location.reload();
                        }
                    }
                });
                
                getData(wttApiBaseUrl + "user/authenticated").then(function (result) {
                    $scope.wttAuth = result;

                    if (result !== "false") {
                        $scope.accountPromise = getData(wttApiBaseUrl + "user/info").then(function (userInfo) {
                            $scope.userInfo = userInfo;

                            $scope.displayTrialDays = function (days) {
                                if (days <= 0) return "0";
                                return days;
                            };
                        });
                    }
                });
            }

            init();
        });

    angular.module("umbraco.resources").factory("webtexttoolResource", function ($http) {
        return {
            getWttData: function() {
                return $http.get("backoffice/Webtexttool/Dashboard/GetWttData");
            }
        };
    });
})();