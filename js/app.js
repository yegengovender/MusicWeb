var SongzaApp = angular.module('SongzaApp', ['songzaServices']);

var songzaServices = angular.module('songzaServices', []);

songzaServices.factory('songzaApi', function ($http) {
    return {
        categories: function () {
            return $http.get('http://musicapi.azurewebsites.net/api/songza/categories');
        },
        collections: function (category) {
            return $http.get('http://musicapi.azurewebsites.net/api/songza/CategoryFilter?category=' + category );
        },
        stations: function (station_ids) {
            return $http.post('http://musicapi.azurewebsites.net/api/songza/Stations', station_ids);
        },
        nextSong: function (station) {
            return $http.post('http://musicapi.azurewebsites.net/api/songza/StationNext', { stationID: station.id });
        }
    };
});
songzaServices.factory('echoNestApi', function ($http) {
    return {
        artistInfo: function (name) {
            return $http.get('http://developer.echonest.com/api/v4/artist/search?api_key=KUDAPUSC2PCCLMIO7&format=json&name=' + name + '&results=1');
        },
        artistImages: function (id) {
            return $http.get('http://developer.echonest.com/api/v4/artist/images?api_key=KUDAPUSC2PCCLMIO7&format=json&id=' + id);
        }
    };
});


SongzaApp.factory('audio', function ($document, $rootScope) {
    var audioElement = $document[0].getElementById('player'); // <-- Magic trick here
    var _time;
    audioElement.addEventListener('ended', function () {
        $rootScope.$broadcast("trackFinished");
    });

    return {
        audioElement: audioElement,

        play: function (filename) {
            audioElement.src = filename;
            audioElement.play();
        },

        resume: function () {
            audioElement.currentTime = _time;
            audioElement.play();
        },

        pause: function () {
            _time = audioElement.currentTime;
            audioElement.pause();
        }
    };
});

SongzaApp.directive('scrollList', function () {
    return {
        restrict: 'E',
        scope: {
            itemList: '=collection'
        },
        templateUrl: "/Templates/template.html"
    };
});

SongzaApp.controller('songzaController', function ($scope, $http, $sce, audio, songzaApi, echoNestApi) {

    var makeList = function (data, clickActionCallback, styleFunction) {
        var _data = data;
        var _clickActionCallback = clickActionCallback;
        var _selectedItem = data[0];
        var _style = styleFunction(0);

        return {
            selected: false,
            items: _data,
            selectedItem: _selectedItem,
            clickActionCallback: _clickActionCallback,
            style: _style,
            clickAction: function (item) {
                this.selectedItem = item;
                var itemIndex = this.items.indexOf(item);
                this.style = styleFunction(itemIndex);
                this.clickActionCallback(item);
            },
            increment: function () {
                var index = this.items.indexOf(this.selectedItem);
                if (index < this.items.length) {
                    index++;
                    this.clickAction(this.items[index]);
                }
            },
            decrement: function () {
                var index = this.items.indexOf(this.selectedItem);
                if (index > 0) {
                    index--;
                    this.clickAction(this.items[index]);
                }
            }
        };
    };

    $scope.categories = [];
    $scope.collections = [];
    $scope.stations = [];
    $scope.columns = [$scope.categories, $scope.collections, $scope.stations];

    var setColumn = function(selectColumn) {
        $scope.columns = [$scope.categories, $scope.collections, $scope.stations];
        $scope.column = selectColumn;
        $scope.columns.forEach(function (column) {
            column.selected = (column == selectColumn);
        });
    };


    var setStyle = function (index) {
        return { top: (index * -30) + 100 + 'px' };
    };

    // Startup + Categories
    songzaApi.categories().then(function (result) {
        $scope.categories = makeList(result.data, $scope.categoryClick, setStyle);
        getCollections($scope.categories.selectedItem);
        setColumn($scope.categories);
    });

    $scope.categoryClick = function () {
        setColumn($scope.categories);
        getCollections($scope.categories.selectedItem);
    };


    // Collections
    var getCollections = function (category) {
        songzaApi.collections(category.Name).then(function (result) {
            $scope.collections = makeList(result.data, $scope.collectionClick, setStyle);
            getStations($scope.collections.selectedItem);
        });
    };

    $scope.collectionClick = function () {
        setColumn($scope.collections);
        getStations($scope.collections.selectedItem);
    };

    // Stations
    var getStations = function (collection) {
        songzaApi.stations(collection.station_ids).then(function (result) {
            $scope.stations = makeList(result.data, $scope.stationClick, setStyle);
        });
    };


    $scope.stationClick = function () {
        setColumn($scope.stations)
    };



    // Keyboard UI
    var upArrow = function () {
        $scope.column.decrement();
    };

    var downArrow = function () {
        $scope.column.increment();
    };

    var leftArrow = function () {
        var selectedColumn = $scope.columns.indexOf($scope.column);
        if (selectedColumn > 0 ) {
            selectedColumn--;
            setColumn($scope.columns[selectedColumn]);
        }
    };

    var rightArrow = function () {
        var selectedColumn = $scope.columns.indexOf($scope.column);
        if (selectedColumn < $scope.columns.length - 1) {
            selectedColumn++;
            setColumn($scope.columns[selectedColumn]);
        }
    };

    var spaceBar = function () {
        var station = $scope.stations.selectedItem;
        if ($scope.playingStation == station && $scope.isPlaying) {
            $scope.pause();
            return;
        }

        if ($scope.playingStation == station && !$scope.isPlaying) {
            audio.resume();
            $scope.isPlaying = true;
            return;
        }

        $scope.playStation(station);
    };

    $scope.doKeyEvent = function (event) {
        var keycode = event.keyCode;
        switch (keycode) {
            case 37: leftArrow(); event.preventDefault(); break;
            case 38: upArrow(); event.preventDefault(); break;
            case 39: rightArrow(); event.preventDefault(); break;
            case 40: downArrow(); event.preventDefault(); break;
            case 32: spaceBar(); event.preventDefault(); break;
        }
        console.debug(keycode);
    };

    $scope.getStationNext = function (station) {
        songzaApi.nextSong(station).then(function (result) {
            $scope.stationNext = result.data;
            audio.play($sce.trustAsResourceUrl($scope.stationNext.listen_url));
            var artist = result.data.song.artist;
            var name = artist.name;

            echoNestApi.artistInfo(name).then(function (result) {
                var artist = result.data.response.artists;

                if(artist){
                    var id = artist[0].id;

                    echoNestApi.artistImages(id).then(function (result) {
                        var images = result.data.response.images;
                        for(var i=0;i<images.length;i++) {
                            var url = images[i].url;
                            setTimeout(function(){
                                var pos = (i % 2)==0 ? 'top': 'bottom';
                                $scope.mainStyle = {'background-image': 'url("' + url + '")', 'background-position-y': pos};
                            },15000);
                        }
                    });
                }
            });
        });
    };

    $scope.playStation = function (station) {
        if ($scope.playingStation == station) {
            audio.resume();
        }
        else {
            $scope.getStationNext(station);
            $scope.playingStation = station;
        }
        $scope.isPlaying = true;
    };

    $scope.$on("trackFinished", function () {
        $scope.getStationNext($scope.playingStation);
    });

    $scope.pause = function () {
        audio.pause();
        $scope.isPlaying = false;
    };


    $scope.isPlaying = false;
});

