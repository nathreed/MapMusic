//https://github.com/frogcat/leaflet-tilelayer-colorpicker/blob/master/leaflet-tilelayer-colorpicker.js
(function() {
    L.TileLayer.ColorPicker = L.TileLayer.extend({
        options: {
            crossOrigin: "anonymous"
        },
        getColor: function(latlng) {
            let size = this.getTileSize();
            let point = this._map.project(latlng, this._tileZoom).floor();
            let coords = point.unscaleBy(size).floor();
            let offset = point.subtract(coords.scaleBy(size));
            coords.z = this._tileZoom;
            let tile = this._tiles[this._tileCoordsToKey(coords)];
            if (!tile || !tile.loaded) return null;
            try {
                let canvas = document.createElement("canvas");
                canvas.width = 1;
                canvas.height = 1;
                let context = canvas.getContext('2d');
                context.drawImage(tile.el, -offset.x, -offset.y, size.x, size.y);
                return context.getImageData(0, 0, 1, 1).data;
            } catch (e) {
                return null;
            }
        }
    });
    L.tileLayer.colorPicker = function(url, options) {
        return new L.TileLayer.ColorPicker(url, options);
    };
})();