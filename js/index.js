(function(exports) {

  var model = {
    states: [],
    statesByName: {},
    stateFeatures: [],
    stateFeaturesByName: {}
  };

  var proj = d3.geo.albersUsa();

  queue()
    .defer(d3.csv, "data/atf-states.csv")
    .defer(d3.json, "data/us-states.topojson")
    .await(function ready(error, states, topology) {
      model.statesTopology = topology;

      var geometries = topology.objects.states.geometries,
          features = geometries.map(function(geom) {
            return topojson.object(topology, geom);
          }),
          featuresByName = d3.nest()
            .key(function(d) { return d.id; })
            .rollup(function(d) { return d[0]; })
            .map(features);

      model.stateFeatures = features;
      model.stateFeaturesByName = featuresByName;

      var unpack = d3.sheet.unpack();
      states.sort(function(a, b) {
        return d3.ascending(a.state, b.state);
      });

      model.states = states.map(function(row) {
        var feature = featuresByName[row.state],
            state = repack(unpack(row));
        state.feature = feature;
        feature.properties = state;
        return state;
      });

      model.statesByName = d3.nest()
        .key(function(d) { return d.state; })
        .rollup(function(d) { return d[0]; })
        .map(model.states);

      console.log("model:", model);

      initMap();
      initStates();

    });

  function makeId(str) {
    return str.replace(/\W/g, "_").toLowerCase();
  }

  function initMap() {
    var width = 880,
        height = 500,
        aspect = width / height,
        map = d3.select("#us-map")
          .append("svg")
            .attr("viewBox", [0, 0, width, height].join(" "))
            .attr("preserveAspectRatio", "meet xMidYMid"),
        statesGroup = map.append("g")
          .attr("class", "shapes"),
        stateLinks = statesGroup.selectAll("a")
          .data(model.stateFeatures)
          .enter()
          .append("a")
            .attr("xlink:href", function(d) {
              return "#state-" + makeId(d.id);
            }),
        statePaths = stateLinks.append("path")
          .attr("class", "state")
          .attr("id", function(d) {
            return "state-shape-" + makeId(d.id);
          });

    // preserve aspect ratio
    function resize() {
      map.attr("height", ~~(map.property("offsetWidth") / aspect));
    }

    d3.select(window).on("resize", resize);
    resize();

    statesGroup.attr("transform", null);

    var geo = d3.geo.path()
      .projection(proj);
    statePaths.attr("d", geo);
  }

  function initStates() {
    var list = d3.select("#states"),
        states = list.selectAll(".state")
          .data(model.states)
          .enter()
          .append("div")
            .attr("class", "state")
            .attr("id", function(d) {
              return "state-" + makeId(d.state);
            });

    states.append("h2")
      .attr("class", "title")
      .text(function(d) {
        return d.state;
      });

    var path = d3.geo.path()
          .projection(proj),
        size = 230,
        maps = states.append("div")
          .attr("class", "map")
          .append("svg")
            .attr("viewBox", [0, 0, size, size])
            .attr("preserveAspectRatio", "meet xMidYMid"),
        shapes = maps.append("path")
          .datum(function(d) {
            return d.feature;
          })
          .attr("class", "state")
          .attr("d", path)
          .attr("transform", function(d) {
            var offset = path.centroid(d);
            offset[0] = ~~(size / 2 - offset[0]);
            offset[1] = ~~(size / 2 - offset[1]);
            return "translate(" + offset + ")";
          });

      function resize() {
        // width of the first one determines the rest
        var w = maps.property("offsetWidth");
        maps.attr("height", w);
      }

      d3.select(window).on("resize", resize);
      resize();
  }

  function repack(unpackedObject) {
    var packed = {};
    for (var key in unpackedObject) {
      var val = unpackedObject[key];
      packed[key] = (typeof val === "object" && val.hasOwnProperty("value"))
        ? val.value
        : val;
    }
    return packed;
  }

  d3.sheet = {};
  d3.sheet.parse = {};

  var d3_sheet_numberPattern = /^\s*([\d\.\,]+)\s*$/,
      d3_sheet_numberReplace = function(match, num) {
        return num.replace(/,/g, "");
      };
  d3.sheet.parse.number = function(str) {
    return str
      ? +str.replace(d3_sheet_numberPattern, d3_sheet_numberReplace)
      : NaN;
  };

  var d3_sheet_moneyPattern = /^\s*\$([\d\.\,]+)\s*$/,
      d3_sheet_moneyReplace = function(match, num) {
        return num.replace(/,/g, "");
      };
  d3.sheet.parse.money = function(str) {
    return str
      ? +str.replace(d3_sheet_moneyPattern, d3_sheet_moneyReplace)
      : NaN;
  };

  /**
   * The spreadsheet "unpacker" returns a function suitable for Array mapping,
   * which converts the columns (keys) of row objects (from text delimited
   * files) into objects with the original and parsed values. By default, each
   * key in a row object is coerced with the native Number() function, and if
   * the resulting value is not NaN, the numeric value is stored. E.g.:
   *
   * var unpack = d3.sheet.unpack();
   * unpack({foo: "100"}) ->
   * 
   * {
   *   foo: {
   *     string: "100",
   *     numeric: true,
   *     value: 100
   *   }
   * }
   *
   * You can specify custom parsers for each column:
   *
   * var unpack = d3.sheet.unpack()
   *   .column("amount", d3.sheet.unpack.money)
   *
   * unpack({year: "2000", amount: "$5,000.00"}) ->
   *
   * {
   *   year: {
   *     string: "2000",
   *     numeric: true,
   *     value: 2000
   *   },
   *   amount: {
   *     string: "$5,000.00",
   *     numeric: true,
   *     value: 5000.0
   *   }
   * }
   */
  d3.sheet.unpack = function() {
    var parsers = {};

    function unpack(row) {
      var out = {};
      for (var key in row) {
        var value = row[key],
            parser = parsers[key] || d3.sheet.parse.number,
            num = parser(value),
            numeric = !isNaN(num);
        out[key] = {
          string: value,
          numeric: numeric,
          value: numeric ? num : value
        };
      }
      return out;
    }

    unpack.column = function(key, parse) {
      if (arguments.length === 2) {
        parsers[key] = parse;
        return unpack;
      } else if (arguments.length === 1) {
        return parsers[key];
      } else {
        throw "unpack.column() expects 1 or 2 arguments; got " + arguments.length;
      }
    };

    unpack.columns = function(cols) {
      if (arguments.length) {
        for (var key in cols) {
          columns[key] = cols[key];
        }
        return unpack;
      } else {
        return columns;
      }
    };

    return unpack;
  };

})(this);
