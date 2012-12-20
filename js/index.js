(function(exports) {

  var model = exports.model = {
    states: [],
    statesTopology: {},
    stateTopoGeometries: [],
    statesByName: {},
    stateFeatures: [],
    stateFeaturesByName: {},
    rtcYears: [],
    lastRtcYear: 2011,
    rtcStrings: {
      "N": "no issue",
      "M": "may carry",
      "S": "shall issue",
      "U": "unrestricted"
    }
  };

  var proj = d3.geo.albersUsa();

  d3.csv("data/atf-states.csv", function(states) {
    d3.csv("data/rtc-minimal.csv", function(rtc) {
      d3.json("data/us-states-segmentized.topojson", function(topology) {
        init(null, states, rtc, topology);
      });
    })
  });

  function init(error, states, rtc, topology) {
    var geometries = topology.objects.states.geometries,
        features = geometries.map(function(geom) {
          return topojson.object(topology, geom);
        }),
        featuresByName = d3.nest()
          .key(function(d) { return d.id; })
          .rollup(function(d) { return d[0]; })
          .map(features);

    model.statesTopology = topology;
    model.stateTopoGeometries = geometries;
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

    model.stateFeatures = features.filter(function(feature) {
      return feature.properties;
    });

    model.rtcYears = d3.keys(rtc[0])
      .filter(function(key) { return key.match(/^\d{4}$/); })
      .map(Number)
      .sort(d3.ascending);

    model.lastRtcYear = model.rtcYears[model.rtcYears.length - 1];

    var rtcByState = d3.nest()
      .key(function(d) { return d.State; })
      .rollup(function(d) { return d[0]; })
      .map(rtc);

    model.states.forEach(function(state) {
      state.rtc = rtcByState[state.state];
    });

    model.statesByName = d3.nest()
      .key(function(d) { return d.state; })
      .rollup(function(d) { return d[0]; })
      .map(model.states);

    console.log("model:", model);

    initMap();
    initStates();
  }

  function makeId(str) {
    return str.replace(/\W/g, "_").toLowerCase();
  }

  function initMap() {
    var width = 880,
        height = 500,
        aspect = width / height,
        map = d3.select("#us-map svg")
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
          .attr("class", function(d) {
            return ["state", "rtc-" + d.properties.rtc[model.lastRtcYear]].join(" ");
          })
          .attr("id", function(d) {
            return "state-shape-" + makeId(d.id);
          }),
        scaleBy = d3.selectAll("#scale-by > *")
          .datum(function() {
            return this.getAttribute("data-scale");
          }),
        scaleByLinks = scaleBy.select("a")
          .on("click", function(field) {
            if (field) {
              rescale(field);
            } else {
              reset(true);
            }
            scaleBy.classed("active", function(d) {
              return d === field;
            });

            d3.event.preventDefault();
            return false;
          });

    var hatches = [
          {key: "stand-your-ground", size: 5},
          {key: "castle-doctrine", size: 10}
        ],
        patterns = [];
    d3.keys(model.rtcStrings).forEach(function(rtc) {
      hatches.forEach(function(hatch) {
        patterns.push({
          id: [hatch.key, rtc].join("-"),
          hatch: hatch.key,
          rtc: rtc,
          size: hatch.size
        });
      });
    });

    var patterns = map.select("defs")
      .selectAll("pattern")
      .data(patterns)
      .enter()
        .append("pattern")
          .attr("id", function(d) { return d.id; })
          .attr("patternUnits", "userSpaceOnUse")
          .attr("x", 0)
          .attr("y", 0)
          .attr("width", function(d) { return d.size; })
          .attr("height", function(d) { return d.size; })
          .append("g");
    patterns.append("rect")
      .attr("class", function(d) { return "rtc-" + d.rtc; })
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", function(d) { return d.size; })
      .attr("height", function(d) { return d.size; });
    patterns.selectAll("path")
      .data(function(d) {
        return d3.range(2).map(d3.functor(d));
      })
      .enter()
        .append("path")
        .attr("d", function(d, i) {
          return (i == 0)
            ? ["M0,0,l", d.size, ",", d.size].join("")
            : ["M", d.size, ",0,l", -d.size, ",", d.size].join("");
        });

    statePaths.style("fill", function(d) {
      return getStateFill(d.properties);
    });

    var topology = model.statesTopology,
        geometries = model.stateTopoGeometries;
        carto = d3.cartogram()
          .projection(proj)
          .properties(function(d) {
            return model.statesByName[d.id];
          }),
        path = d3.geo.path()
          .projection(proj),
        duration = 500;

    // preserve aspect ratio
    function resize() {
      map.attr("height", ~~(map.property("offsetWidth") / aspect));
    }

    function reset(animate) {
      statePaths.data(model.stateFeatures);

      var target = animate
        ? statePaths.transition()
            .duration(duration)
            .ease("linear")
        : statePaths;

      target.attr("d", path);
    }

    function rescale(field) {
      var values = model.states.map(function(d) {
              return +d[field];
            })
            .filter(function(n) {
              return !isNaN(n);
            })
            .sort(d3.ascending),
          scale = d3.scale.linear()
            .domain(d3.extent(values))
            .range([10, 1000]);

      carto.projection(proj);
      carto.value(function(d) {
        return scale(+d.properties[field] || 0);
      });

      // console.log("values:", values);

      var warped = carto(topology, geometries).features;
      statePaths.data(warped, function(d) {
          // console.log(d.id, d.properties[field], scale(+d.properties[field]));
          return d.id;
        })
        .transition()
          .duration(duration)
          .ease("linear")
          .attr("d", carto.path);
    }

    reset();

    try {
      window.addEventListener("resize", resize);
    } catch (err) {
    }
    resize();
  }

  function initStates() {
    var list = d3.select("#states"),
        states = list.selectAll(".state")
          .data(model.states)
          .enter()
          .append("div")
            .attr("class", "state row")
            .attr("id", function(d) {
              return "state-" + makeId(d.state);
            });

    var left = states.append("div")
      .attr("class", "left span3");

    var right = states.append("div")
      .attr("class", "left span9");

    left.append("h2")
      .attr("class", "title")
      .text(function(d) {
        return d.state;
      });

    var path = d3.geo.path()
          .projection(proj),
        size = 230,
        padding = 5,
        innerSize = size - padding * 2,
        center = [size / 2, size / 2],
        maps = left.append("div")
          .attr("class", "map")
          .append("svg")
            .attr("viewBox", [0, 0, size, size])
            .attr("preserveAspectRatio", "meet xMidYMid"),
        shapes = maps.append("path")
          .datum(function(d) {
            return d.feature;
          })
          .attr("class", function(d) {
            return ["state", "rtc-" + d.properties.rtc[model.lastRtcYear]].join(" ");
          })
          .attr("d", path)
          .style("fill", function(d) {
            return getStateFill(d.properties);
          })
          .attr("transform", function(d) {
            var bbox = this.getBBox(),
                scale = 1 / Math.max(bbox.width / innerSize, bbox.height / innerSize),
                transform = [];
            // move it to 0,0
            transform.push("translate("
              + [-(bbox.x + bbox.width / 2), -(bbox.y + bbox.height / 2)] + ")");
            // scale it
            transform.push("scale(" + [scale, scale] + ")");
            // move it back to the center
            transform.push("translate(" + center + ")");
            return transform.reverse().join(" ");
          });

    function resize() {
      // width of the first one determines the rest
      maps.attr("height", maps.property("offsetWidth"));
    }

    try {
      window.addEventListener("resize", resize);
    } catch (err) {
    }

    resize();
  }

  function getStateFill(d) {
    var stand = d["Stand Your Ground"] == 1,
        castle = d["Any Castle Doctrine Expansion"] == 1;
    if (stand || castle) {
      var prefix = stand
            ? "stand-your-ground"
            : "castle-doctrine",
          pattern = [prefix, "-", d.rtc[model.lastRtcYear]].join("");
      return "url(#" + pattern + ")";
    } else {
      return null;
    }
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
