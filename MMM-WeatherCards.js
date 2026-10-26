/* MMM-WeatherCards — Glass Edition
 * Open-Meteo Forecast + Air Quality, key-free; approximate local Moon phase.
 * Standalone MagicMirror² frontend module; does not require npm packages.
 */
// module WEATHER POLISH V1 - six hours, five days, rain odds
Module.register("MMM-WeatherCards", {
  defaults: {
    location: "Sample City",
    units: "imperial",
    locale: "en-US",
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York",
    updateInterval: 15 * 60 * 1000,
    hourlyCount: 6,
    forecastDays: 5,
  },

  getStyles: function () {
    return ["MMM-WeatherCards.css"];
  },

  start: function () {
    this.config.hourlyCount = Math.max(
      1,
      Math.min(24, Math.floor(Number(this.config.hourlyCount) || 6)),
    );
    this.config.forecastDays = Math.max(
      1,
      Math.min(7, Math.floor(Number(this.config.forecastDays) || 5)),
    );
    this.weatherData = null;
    this.airData = null;
    this.weatherError = null;
    this.airError = null;
    this.fetchAll();
    var self = this;
    this.timer = setInterval(function () {
      self.fetchAll();
    }, this.config.updateInterval);
  },

  suspend: function () {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },

  resume: function () {
    this.fetchAll();
    if (!this.timer) {
      var self = this;
      this.timer = setInterval(function () {
        self.fetchAll();
      }, this.config.updateInterval);
    }
  },

  fetchJSON: function (url) {
    return fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.reason || "API error");
        return data;
      });
  },

  fetchAll: function () {
    var self = this;
    var base = {
      latitude: String(this.config.latitude),
      longitude: String(this.config.longitude),
      timezone: this.config.timezone,
    };
    var forecast = new URLSearchParams(
      Object.assign({}, base, {
        temperature_unit:
          this.config.units === "metric" ? "celsius" : "fahrenheit",
        wind_speed_unit: this.config.units === "metric" ? "kmh" : "mph",
        forecast_days: String(Math.max(2, this.config.forecastDays + 1)),
        current:
          "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_direction_10m",
        hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
        daily:
          "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
      }),
    );
    var air = new URLSearchParams(
      Object.assign({}, base, {
        current: "us_aqi,pm2_5",
      }),
    );

    this.fetchJSON(
      "https://api.open-meteo.com/v1/forecast?" + forecast.toString(),
    )
      .then(function (data) {
        self.weatherData = data;
        self.weatherError = null;
        self.updateDom(250);
      })
      .catch(function (err) {
        self.weatherError = err.message;
        console.error("MMM-WeatherCards forecast:", err);
        self.updateDom(250);
      });

    // Independent request: an air API error never breaks the weather forecast.
    this.fetchJSON(
      "https://air-quality-api.open-meteo.com/v1/air-quality?" + air.toString(),
    )
      .then(function (data) {
        self.airData = data;
        self.airError = null;
        self.updateDom(250);
      })
      .catch(function (err) {
        self.airError = err.message;
        console.warn("MMM-WeatherCards air quality:", err);
        self.updateDom(250);
      });
  },

  el: function (tag, cls, content) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (content !== undefined && content !== null)
      e.textContent = String(content);
    return e;
  },

  svg: function (className, viewBox) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", viewBox || "0 0 64 64");
    svg.setAttribute("class", className || "");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    return svg;
  },

  shape: function (parent, tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (key) {
      e.setAttribute(key, attrs[key]);
    });
    parent.appendChild(e);
    return e;
  },

  addSun: function (svg, cx, cy, radius) {
    var self = this;
    for (var n = 0; n < 8; n++) {
      var a = (n * Math.PI) / 4;
      self.shape(svg, "line", {
        x1: (cx + Math.cos(a) * (radius + 6)).toFixed(1),
        y1: (cy + Math.sin(a) * (radius + 6)).toFixed(1),
        x2: (cx + Math.cos(a) * (radius + 12)).toFixed(1),
        y2: (cy + Math.sin(a) * (radius + 12)).toFixed(1),
        stroke: "#ffdc74",
        "stroke-width": "3.1",
        "stroke-linecap": "round",
      });
    }
    self.shape(svg, "circle", {
      cx: cx,
      cy: cy,
      r: radius,
      fill: "#ffce47",
      stroke: "#ffe08a",
      "stroke-width": "1.1",
    });
  },

  addCloud: function (svg) {
    this.shape(svg, "path", {
      d: "M15 48 C6 48 6 36 15 34 C15 23 27 19 33 27 C43 19 55 27 53 38 C61 42 57 50 48 50 H17 Z",
      fill: "#eef4ff",
      stroke: "#d0ddf3",
      "stroke-width": "1.6",
      "stroke-linejoin": "round",
    });
  },

  conditionIcon: function (code, day, cls) {
    var svg = this.svg("wd-svg " + (cls || ""));
    var c = Number(code);
    var daytime = day !== 0;
    var rainy =
      [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].indexOf(
        c,
      ) !== -1;
    var snowy = [71, 73, 75, 77, 85, 86].indexOf(c) !== -1;
    var cloud = c !== 0;
    if (daytime && (c === 0 || c === 1 || c === 2))
      this.addSun(svg, cloud ? 23 : 32, cloud ? 24 : 32, cloud ? 11 : 16);
    if (!daytime && c <= 2) {
      this.shape(svg, "circle", { cx: 32, cy: 30, r: 18, fill: "#dce6fc" });
      this.shape(svg, "circle", { cx: 42, cy: 21, r: 17, fill: "#50627a" });
    }
    if (cloud || c === 2) this.addCloud(svg);
    if (rainy) {
      [
        [22, 53],
        [34, 55],
        [46, 53],
      ].forEach(function (p) {
        var x = p[0],
          y = p[1];
        this.shape(svg, "path", {
          d: "M" + x + " " + (y - 2) + " l-2 6",
          stroke: "#88d6ff",
          "stroke-width": "3",
          "stroke-linecap": "round",
        });
      }, this);
    }
    if (snowy) {
      [
        [22, 55],
        [34, 56],
        [46, 55],
      ].forEach(function (p) {
        this.shape(svg, "circle", {
          cx: p[0],
          cy: p[1],
          r: 2.1,
          fill: "#cdeaff",
        });
      }, this);
    }
    if ([45, 48].indexOf(c) !== -1) {
      [55, 59].forEach(function (y) {
        this.shape(svg, "line", {
          x1: 12,
          y1: y,
          x2: 52,
          y2: y,
          stroke: "#deefff",
          "stroke-width": "2",
        });
      }, this);
    }
    if ([95, 96, 99].indexOf(c) !== -1)
      this.shape(svg, "path", {
        d: "M34 49 L27 59 H34 L30 64 L44 52 H36 L39 49",
        fill: "#ffd36d",
      });
    return svg;
  },

  detailIcon: function (kind) {
    var svg = this.svg("wd-line-icon wd-line-" + kind);
    if (kind === "wind") {
      [
        "M8 20 H41 Q51 20 51 12 Q51 5 44 6 Q39 7 39 12",
        "M6 31 H52 Q61 31 59 39 Q57 45 50 42",
        "M12 42 H37 Q45 42 45 49 Q45 56 38 55",
      ].forEach(function (d) {
        this.shape(svg, "path", {
          d: d,
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "3",
          "stroke-linecap": "round",
        });
      }, this);
    } else {
      var isRise = kind === "sunrise";
      this.shape(svg, "line", {
        x1: 7,
        y1: 43,
        x2: 57,
        y2: 43,
        stroke: "currentColor",
        "stroke-width": "2.7",
        "stroke-linecap": "round",
      });
      this.shape(svg, "path", {
        d: "M18 43 A14 14 0 0 1 46 43",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2.8",
        "stroke-linecap": "round",
      });
      [
        [32, 13, 32, 18],
        [12, 23, 17, 28],
        [52, 23, 47, 28],
      ].forEach(function (p) {
        this.shape(svg, "line", {
          x1: p[0],
          y1: p[1],
          x2: p[2],
          y2: p[3],
          stroke: "currentColor",
          "stroke-width": "2.6",
          "stroke-linecap": "round",
        });
      }, this);
      this.shape(svg, "path", {
        d: isRise
          ? "M32 61 V49 M26 55 L32 49 L38 55"
          : "M32 49 V61 M26 55 L32 61 L38 55",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2.6",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
    }
    return svg;
  },

  fmtTemp: function (n) {
    return Number.isFinite(Number(n)) && n !== null
      ? Math.round(Number(n)) + "°"
      : "--°";
  },
  fmtTime: function (iso) {
    if (!iso || iso.indexOf("T") === -1) return "--";
    var match = /T(\d{1,2}):(\d{2})/.exec(iso);
    if (!match) return "--";
    var hour = Number(match[1]),
      period = hour >= 12 ? "PM" : "AM";
    return (hour % 12 || 12) + ":" + match[2] + " " + period;
  },
  shortTime: function (iso) {
    return this.fmtTime(iso).replace(":00 ", " ");
  },
  windDirection: function (degrees) {
    if (degrees === null || degrees === undefined) return "";
    var dirs = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];
    return dirs[
      Math.round((((Number(degrees) % 360) + 360) % 360) / 22.5) % 16
    ];
  },
  dayLabel: function (i, date) {
    if (i === 0) return "Today";
    if (i === 1) return "Tomorrow";
    return new Date(date + "T12:00:00").toLocaleDateString(this.config.locale, {
      weekday: "long",
    });
  },
  dayDescription: function (code, isDay) {
    var c = Number(code);
    /* NIGHT_CONDITIONS_FIX_2026 */
    if (Number(isDay) === 0) {
      if (c === 0) return "Clear";
      if (c === 1) return "Mostly Clear";
      if (c === 2) return "Partly Cloudy";
    }
    if (c === 0) return "Sunny";
    if (c <= 2) return "Mostly Sunny";
    if (c === 3) return "Cloudy";
    if (c === 45 || c === 48) return "Foggy";
    if ([51, 53, 55, 56, 57].indexOf(c) !== -1) return "Drizzle";
    if ([61, 63, 65, 66, 67, 80, 81, 82].indexOf(c) !== -1) return "Rainy";
    if ([71, 73, 75, 77, 85, 86].indexOf(c) !== -1) return "Snowy";
    if (c >= 95) return "Stormy";
    return "Current Weather";
  },
  aqiLabel: function (aqi) {
    if (aqi <= 50) return ["Good", "good"];
    if (aqi <= 100) return ["Moderate", "moderate"];
    if (aqi <= 150) return ["Sensitive Groups", "sensitive"];
    if (aqi <= 200) return ["Unhealthy", "unhealthy"];
    if (aqi <= 300) return ["Very Unhealthy", "unhealthy"];
    return ["Hazardous", "unhealthy"];
  },
  moonData: function () {
    // Approximation based on the 2000-01-06 18:14 UTC new moon, synodic period 29.530588853 days.
    // Sufficient for a household display; not an astronomical ephemeris.
    var ageDays =
      ((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % 29.530588853;
    if (ageDays < 0) ageDays += 29.530588853;
    var p = ageDays / 29.530588853;
    var names = [
      "New Moon",
      "Waxing Crescent",
      "First Quarter",
      "Waxing Gibbous",
      "Full Moon",
      "Waning Gibbous",
      "Last Quarter",
      "Waning Crescent",
    ];
    var index = Math.floor(((p + 1 / 16) % 1) * 8);
    return {
      phase: p,
      illumination: Math.round(50 * (1 - Math.cos(p * 2 * Math.PI))),
      name: names[index],
    };
  },
  moonGraphic: function (phase) {
    var svg = this.svg("wd-moon-svg");
    this.shape(svg, "circle", {
      cx: 32,
      cy: 32,
      r: 23,
      fill: "#43566e",
      stroke: "#ced6e7",
      "stroke-width": "1.2",
    });
    // Use a clean SVG crescent/gibbous terminator (waxing illuminated on the right).
    var angle = 2 * Math.PI * phase,
      rx = Math.max(0.1, 23 * Math.abs(Math.cos(angle)));
    var waxing = phase < 0.5;
    var isThin = (waxing && phase < 0.25) || (!waxing && phase > 0.75);
    var outer = waxing
      ? "M32 9 A23 23 0 0 1 32 55"
      : "M32 55 A23 23 0 0 1 32 9";
    var inner = waxing
      ? " A" + rx + " 23 0 0 " + (isThin ? 0 : 1) + " 32 9"
      : " A" + rx + " 23 0 0 " + (isThin ? 0 : 1) + " 32 55";
    this.shape(svg, "path", { d: outer + inner + " Z", fill: "#e9eaf2" });
    return svg;
  },

  getDom: function () {
    var root = this.el("div", "wd-dashboard");
    root.style.setProperty("--hour-count", this.config.hourlyCount);
    root.style.setProperty("--day-count", this.config.forecastDays);
    var data = this.weatherData;
    if (!data || !data.current || !data.daily || !data.hourly) {
      root.appendChild(
        this.el(
          "div",
          "wd-glass wd-status",
          this.weatherError
            ? "Weather unavailable: " + this.weatherError
            : "Loading weather…",
        ),
      );
      return root;
    }
    var current = data.current,
      daily = data.daily,
      hourly = data.hourly,
      self = this;

    var main = this.el("section", "wd-glass wd-main-card");
    main.appendChild(
      this.el("div", "wd-header", this.config.location.toUpperCase()),
    );
    var heroRow = this.el("div", "wd-conditions");
    var details = this.el("div", "wd-details");
    [
      {
        key: "wind",
        value:
          Math.round(current.wind_speed_10m || 0) +
          (this.config.units === "metric" ? " km/h " : " mph ") +
          this.windDirection(current.wind_direction_10m),
        label: "Wind",
      },
      {
        key: "sunrise",
        value: this.fmtTime(daily.sunrise && daily.sunrise[0]),
        label: "Sunrise",
      },
      {
        key: "sunset",
        value: this.fmtTime(daily.sunset && daily.sunset[0]),
        label: "Sunset",
      },
    ].forEach(function (item) {
      var line = self.el("div", "wd-detail-row");
      var icon = self.el("div", "wd-detail-icon");
      icon.appendChild(self.detailIcon(item.key));
      line.appendChild(icon);
      var block = self.el("div", "wd-detail-text");
      block.appendChild(self.el("div", "wd-detail-value", item.value));
      block.appendChild(self.el("div", "wd-detail-label", item.label));
      line.appendChild(block);
      details.appendChild(line);
    });
    heroRow.appendChild(details);
    var visual = this.el("div", "wd-visual");
    visual.appendChild(
      this.conditionIcon(current.weather_code, current.is_day, "wd-hero-svg"),
    );
    heroRow.appendChild(visual);
    var temp = this.el("div", "wd-temperature");
    temp.appendChild(
      this.el("div", "wd-temp-big", this.fmtTemp(current.temperature_2m)),
    );
    temp.appendChild(
      this.el(
        "div",
        "wd-condition-word",
        this.dayDescription(current.weather_code, current.is_day),
      ),
    );
    temp.appendChild(
      this.el(
        "div",
        "wd-feels-like",
        "Feels like " + this.fmtTemp(current.apparent_temperature),
      ),
    );
    heroRow.appendChild(temp);
    main.appendChild(heroRow);

    var hr = this.el("div", "wd-hourly-section");
    hr.appendChild(
      this.el(
        "div",
        "wd-section-title",
        "NEXT " + this.config.hourlyCount + " HOURS",
      ),
    );
    var grid = this.el("div", "wd-hourly-grid");
    var nowHour = String(current.time || "").slice(0, 13),
      count = 0;
    for (
      var i = 0;
      i < hourly.time.length && count < this.config.hourlyCount;
      i++
    ) {
      if (String(hourly.time[i]).slice(0, 13) <= nowHour) continue;
      var item = this.el("div", "wd-hour");
      item.appendChild(
        this.el("div", "wd-hour-time", this.shortTime(hourly.time[i])),
      );
      var iconCell = this.el("div", "wd-hour-icon");
      iconCell.appendChild(
        this.conditionIcon(
          hourly.weather_code[i],
          hourly.is_day[i],
          "wd-hour-svg",
        ),
      );
      item.appendChild(iconCell);
      item.appendChild(
        this.el("div", "wd-hour-temp", this.fmtTemp(hourly.temperature_2m[i])),
      );
      var pct =
        hourly.precipitation_probability && hourly.precipitation_probability[i];
      var rain = this.el("div", "wd-hour-rain");
      var drop = this.svg("wd-drop-icon");
      this.shape(drop, "path", {
        d: "M32 8 C23 22 17 30 17 39 A15 15 0 0 0 47 39 C47 30 41 22 32 8 Z",
        fill: "#a3ddff",
      });
      rain.appendChild(drop);
      rain.appendChild(
        this.el(
          "span",
          "",
          (pct === null || pct === undefined ? "--" : Math.round(pct)) + "%",
        ),
      );
      item.appendChild(rain);
      grid.appendChild(item);
      count++;
    }
    hr.appendChild(grid);
    main.appendChild(hr);
    root.appendChild(main);

    var forecast = this.el("section", "wd-glass wd-forecast-card");
    forecast.appendChild(
      this.el("div", "wd-header", this.config.forecastDays + "-DAY FORECAST"),
    );
    // module SELECTED DESIGN V7 — five equal-width forecast columns.
    var fl = this.el("div", "wd-forecast-list wd-forecast-columns");
    for (
      var j = 0;
      j < Math.min(this.config.forecastDays, daily.time.length);
      j++
    ) {
      var f = this.el("div", "wd-forecast-tile");
      f.appendChild(
        this.el("div", "wd-forecast-day", this.dayLabel(j, daily.time[j])),
      );
      var fi = this.el("div", "wd-forecast-icon");
      fi.appendChild(
        this.conditionIcon(daily.weather_code[j], 1, "wd-forecast-svg"),
      );
      f.appendChild(fi);
      f.appendChild(
        this.el(
          "div",
          "wd-forecast-temps",
          this.fmtTemp(daily.temperature_2m_max[j]) +
            " / " +
            this.fmtTemp(daily.temperature_2m_min[j]),
        ),
      );
      f.appendChild(
        this.el(
          "div",
          "wd-forecast-condition",
          this.dayDescription(daily.weather_code[j]),
        ),
      );
      var p =
        daily.precipitation_probability_max &&
        daily.precipitation_probability_max[j];
      f.appendChild(
        this.el(
          "div",
          "wd-daily-rain",
          (p === null || p === undefined ? "--" : Math.round(p)) + "%",
        ),
      );
      fl.appendChild(f);
    }
    forecast.appendChild(fl);
    root.appendChild(forecast);

    var extras = this.el("div", "wd-extras");
    var air = this.el("section", "wd-glass wd-mini-card wd-aqi-card");
    var aqi =
      this.airData && this.airData.current && this.airData.current.us_aqi;
    var aqiRow = this.el("div", "wd-mini-content");
    var leafIcon = this.svg("wd-mini-symbol wd-leaf-symbol");
    this.shape(leafIcon, "path", {
      d: "M49 12 C28 12 15 18 14 34 C13 45 24 52 35 45 C46 38 50 24 49 12 Z",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "3.1",
      "stroke-linejoin": "round",
    });
    this.shape(leafIcon, "path", {
      d: "M17 49 C22 37 32 29 42 23",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "3",
      "stroke-linecap": "round",
    });
    aqiRow.appendChild(leafIcon);
    var aText = this.el("div", "wd-mini-text");
    aText.appendChild(this.el("div", "wd-mini-title", "AIR QUALITY"));
    if (aqi !== null && aqi !== undefined) {
      var rating = this.aqiLabel(aqi);
      aText.appendChild(
        this.el(
          "div",
          "wd-mini-value wd-aqi-" + rating[1],
          rating[0] + " (" + Math.round(aqi) + ")",
        ),
      );
      var pm = this.airData.current.pm2_5;
      aText.appendChild(
        this.el(
          "div",
          "wd-mini-sub",
          pm === null || pm === undefined
            ? "US AQI"
            : "PM2.5: " + Math.round(pm) + " µg/m³",
        ),
      );
    } else {
      aText.appendChild(this.el("div", "wd-mini-value", "Unavailable"));
      aText.appendChild(this.el("div", "wd-mini-sub", "Checking air quality"));
    }
    // US AQI scale. Clamp the marker at 300+ while retaining the actual numeric reading.
    if (aqi !== null && aqi !== undefined && Number.isFinite(Number(aqi))) {
      var meter = this.el("div", "wd-aqi-meter");
      meter.setAttribute("role", "img");
      meter.setAttribute(
        "aria-label",
        "Air quality index " + Math.round(aqi) + " out of 300 plus",
      );
      var marker = this.el("span", "wd-aqi-marker");
      marker.style.left =
        (Math.max(0, Math.min(300, Number(aqi))) / 300) * 100 + "%";
      meter.appendChild(marker);
      aText.appendChild(meter);
    }
    aqiRow.appendChild(aText);
    air.appendChild(aqiRow);
    extras.appendChild(air);
    var moon = this.moonData();
    var lunar = this.el("section", "wd-glass wd-mini-card wd-lunar-card");
    var lunarRow = this.el("div", "wd-mini-content");
    lunarRow.appendChild(this.moonGraphic(moon.phase));
    var lunarText = this.el("div", "wd-mini-text");
    lunarText.appendChild(this.el("div", "wd-mini-title", "MOON PHASE"));
    lunarText.appendChild(this.el("div", "wd-mini-value", moon.name));
    lunarText.appendChild(
      this.el(
        "div",
        "wd-mini-sub",
        moon.illumination + "% illuminated · approx.",
      ),
    );
    lunarRow.appendChild(lunarText);
    lunar.appendChild(lunarRow);
    extras.appendChild(lunar);
    forecast.appendChild(extras);
    const credit = this.el(
      "a",
      "wd-attribution",
      "Weather and air quality data: Open-Meteo",
    );
    credit.href = "https://open-meteo.com/";
    credit.target = "_blank";
    credit.rel = "noopener noreferrer";
    root.appendChild(credit);
    return root;
  },
});
