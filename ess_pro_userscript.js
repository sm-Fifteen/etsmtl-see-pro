// ==UserScript==
// @name         ETS Recherche de stages PRO
// @namespace    https://gist.github.com/sm-Fifteen/762e564694db40a8477ae9e32496f51b
// @version      0.1
// @description  Pour rendre la recherche de stage moins pénible sur le site du SEE.
// @author       Nicolas Roy-Renaud <nicolas.roy-renaud.1@ens.etsmtl.ca>
// @include      https://see.etsmtl.ca/Postes/Affichages
// @require      https://cdnjs.cloudflare.com/ajax/libs/jsgrid/1.5.3/jsgrid.min.js
// @resource     jsgrid_css https://cdnjs.cloudflare.com/ajax/libs/jsgrid/1.5.3/jsgrid.min.css
// @resource     jsgrid_theme_css https://cdnjs.cloudflare.com/ajax/libs/jsgrid/1.5.3/jsgrid-theme.min.css

// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
	'use strict';

	function loadCSS() {
		var gridcss = GM_getResourceText("jsgrid_css");
		var gridcss2 = GM_getResourceText("jsgrid_theme_css");

		GM_addStyle(gridcss);
		GM_addStyle(gridcss2);

		GM_addStyle(".cellIcon img { width: 20px }");
		GM_addStyle(".jsgrid-cell { white-space: pre-wrap; overflow-x: hidden; }");
		GM_addStyle("a {color: inherit;}");
		GM_addStyle(".jsgrid-row.fetch-data-ok > .jsgrid-cell {background-color: #E0F2F7;} .jsgrid-alt-row.fetch-data-ok > .jsgrid-cell {background-color: #CEECF5;}");
		GM_addStyle(".jsgrid-row.fetch-data-fail > .jsgrid-cell {background-color: #F6CECE;} .jsgrid-alt-row.fetch-data-fail > .jsgrid-cell {background-color: #F5A9A9;}");
	}

	function replaceGrid(jsgridData) {
		$("#grid1").removeData('igGrid');
		$("#ConteneurListes").empty();
		$("#ConteneurListes").append( "<div id='grid1'></div>" );

		$("#grid1").jsGrid(jsgridData);
		return $("#grid1").data("JSGrid");
	}

	function declareCustomFields() {
		var PosteField = function(config) {
			jsGrid.Field.call(this, config);
		};

		PosteField.prototype = new jsGrid.Field({
			itemTemplate: function(value) {
				return value.title;
			},
			sorter: function(val1, val2) {
				return new val1.title.localeCompare(val2.title);
			},
		});

		jsGrid.fields.posteField = PosteField;
	}

	function loadFullDataForAllPostes(jsGridData) {
		Promise.all(jsGridData.data.map(function(record) {
			return getFullPosteData(record).then(function(poste) {
				return { "record" : record, "poste": poste };
			});
		})).then(function(resolvedList) {
			resolvedList.forEach(function(resolvedRecord) {
				// Only deep field is poste, which we'll be replacing
				var updatedRecord = Object.assign({}, resolvedRecord.record);
				updatedRecord.poste = resolvedRecord.poste;

				jsGridData.updateItem(resolvedRecord.record, updatedRecord);
			});
		});
	}

	function getFullPosteData(record) {
		// Stored on a per-userscript basis, so collisions won't happen
		// Using nopost because GUIDs don't count as valid identifiers
		var storedPoste = GM_getValue(record.Nopost);

		if (storedPoste) {
			return Promise.resolve(storedPoste);
		} else {
			return fetchFullPosteData(record.pageURL).then(function(value){
				console.warn("Tried fetching " + record.pageURL);
				GM_setValue(record.Nopost, value);
				return value;
			}).catch(function(e) {
				console.error("Failed to fetch " + record.pageURL);
				var value = Object.assign({}, record.poste);
				// Not saved
				value.fail = true;
				return returnedObj;
			});
		}
	}

	function fetchFullPosteData(pageURL, fakeDom) {
		// Defensive copy, we're not altering the original, it's only getting swapped right before refreshing
		var poste = {};

		var jqPromise = $.get(pageURL).then(function(pageHtml) {
			pageHtml = $.trim(pageHtml);
			var jqObj = $(pageHtml, fakeDom);

			poste.desc = jqObj.find(".divBoiteBleu").text().trim();
			Object.assign(poste, detailsToKeys(jqObj));

			// Only body really needs to be cleared between parses.
			if (fakeDom) $(fakeDom).find("body").empty();

			return poste;
		});

		return new Promise(function(resolve, reject) { jqPromise.then(resolve, reject); });
	}

	function detailsToKeys(jqDocument) {
		var individualKeys = $.map(jqDocument.find(".ligneInfo"), function(domLine) {
			var lineDivs = jqDocument.find(domLine).children("div");
			if (lineDivs.length === 2) {
				var key = $(lineDivs[0]).text().trim().replace(':', '').toLowerCase().replace(/[^\w]/g, '_');
				var val = $(lineDivs[1]).html().trim();

				var result = {};
				result[key] = val;

				return result;
			}
		});

		return individualKeys.reduce(function(accumulator, nextItem) {
			// Somehow, `arrayODicts.reduce(Object.assign, {})` doesn't work
			return Object.assign(accumulator, nextItem);
		}, {});
	}

	function gridDataToJSGrid(ogDataSourceSettings) {
		var jsGridParams = {
			width: "100%",
			inserting: false,
			editing: false,
			sorting: true,
			filtering: true,
			autoload: true,
		};

		// While I could have used the rowClick callback, I've never been fond of using JS to handle links
		jsGridParams.rowRenderer = function(item, itemIndex) {
			var rowObj = $("<tr>");
			var cellClass = this.cellClass;
			this.fields.forEach(function(rowField){
				if (rowField.visible) {
					var content = $("<a>").append(rowField.itemTemplate(item[rowField.name]));
					content.attr("href", item.pageURL);
					var cell = $("<td>").append(content);
					cell.css("width", rowField.width);
					cell.addClass(cellClass);
					cell.addClass(rowField.css);
					cell.addClass(rowField.align ? ("jsgrid-align-" + rowField.align) : "");

					rowObj.append(cell);
				}
			});

			if (item.poste.desc) {
				//rowObj.attr("title", item.poste.desc);
				rowObj.attr("data-row-idx", itemIndex);
				rowObj.addClass("fetch-data-ok");
			} else if (item.poste.fail) {
				rowObj.addClass("fetch-data-fail");
			}

			return rowObj;
		};

		jsGridParams.controller = {
			loadData: function(filter) {
				return $.grep(jsGridParams.data, function(record) {
					return (!filter.Nopost || record.Nopost.toUpperCase().indexOf(filter.Nopost.toUpperCase()) > -1) &&
						(!filter.Lieupost || record.Lieupost === filter.Lieupost) &&
						(!filter.Nmemp || record.Nmemp === filter.Nmemp) &&
						(filter.IsNouveau === undefined || record.IsNouveau === filter.IsNouveau) &&
						(filter.IsFavori === undefined || record.IsFavori === filter.IsFavori) &&
						(filter.IsPostulee === undefined || record.IsPostulee === filter.IsPostulee);
				});
			},
		};

		var parsedData = parseOGGridData(ogDataSourceSettings.dataSource.Records);
		jsGridParams.data = parsedData.data;

		var fields = ogDataSourceSettings.schema.fields;

		function iconCheckboxTemplate(iconUrl, value) {
			var templ = $("<img>");
			if (value) templ.attr("src", iconUrl);
			return templ;
		}

		fields.forEach(function(field) {
			field.width = "auto";

			switch(field.name) {
				case "GuidString":
				case "FinAffichage":
				case "DureePoste":
					field.visible = false;
					break;

				case "IsPostulee":
					field.type = "checkbox";
					field.itemTemplate = iconCheckboxTemplate.bind(this, "/images/okvert.png");
					field.title = "";
					field.css = "cellIcon";
					field.width = "32px";
					break;
				case "IsFavori":
					field.type = "checkbox";
					field.itemTemplate = iconCheckboxTemplate.bind(this, "/images/star.png");
					field.title = "";
					field.css = "cellIcon";
					field.width = "32px";
					break;
				case "IsNouveau":
					field.type = "checkbox";
					field.itemTemplate = iconCheckboxTemplate.bind(this, "/images/nouveau.png");
					field.title = "";
					field.css = "cellIcon";
					field.width = "32px";
					break;

				case "tempsRestant":
					field.width = "60px";
					field.title = "Reste";
					break;

				case "Nopost":
					field.width = "10em";
					field.type = "text";
					field.title = "No. poste";
					break;

				case "Lieupost":
					field.type = "select";
					field.autosearch = true;
					field.selectedIndex = -1;
					field.items = parsedData.lieux;
					field.width = "10em";
					break;

				case "Nmemp":
					field.type = "select";
					field.autosearch = true;
					field.selectedIndex = -1;
					field.items = parsedData.employeurs;
					break;

				case "Titpost":
					field.name = "poste";
					field.type = "posteField";
					break;
			}
		});

		jsGridParams.fields = fields;

		return jsGridParams;
	}

	function parseOGGridData(gridData) {
		var listLieupost = [""];
		var listEnrt = [""];
		var returnDict = {};

		gridData.forEach(function(record, recordIdx){
			record.pageURL = "/Poste/" + record.GuidString;
			//record.FinAffichage = new Date(1507150800000);
			record.IsFavori = (record.IsFavori !== "transparent");
			record.IsPostulee = (record.IsPostulee !== "transparent");
			record.IsNouveau = (record.IsNouveau !== "transparent");
			record.Nmemp = record.Nmemp.toUpperCase();

			if (record.Lieupost.length === 0) { record.Lieupost = "<null>"; }
			if (record.Nmemp.length === 0) { record.Nmemp = "<null>"; }
			var idxLieu = listLieupost.indexOf(record.Lieupost);
			var idxEntr = listEnrt.indexOf(record.Nmemp);

			if (idxLieu < 0) {
				idxLieu = listLieupost.length;
				listLieupost.push(record.Lieupost);
			}

			if (idxEntr < 0) {
				idxEntr = listEnrt.length;
				listEnrt.push(record.Nmemp);
			}

			record.Lieupost = idxLieu;
			record.Nmemp = idxEntr;
			record.poste = {
				"title": record.Titpost,
			};
		});

		returnDict.data = gridData;
		returnDict.lieux = listLieupost;
		returnDict.employeurs = listEnrt;
		return returnDict;
	}

	loadCSS();
	declareCustomFields();
	var jsGridParams = gridDataToJSGrid($("#grid1").data("igGrid").dataSource.settings);
	var jsGridData = replaceGrid(jsGridParams);
	loadFullDataForAllPostes(jsGridData);

	$(document).tooltip({
		items: "tr[data-row-idx]",
		content: function () {
			return $(this).data("JSGridItem").poste.desc;
		}
	});
})();
