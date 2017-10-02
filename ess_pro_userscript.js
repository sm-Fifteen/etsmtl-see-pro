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
// ==/UserScript==

(function() {
	'use strict';

	function loadCSS() {
		var gridcss = GM_getResourceText("jsgrid_css");
		var gridcss2 = GM_getResourceText("jsgrid_theme_css");
		console.log(gridcss);

		GM_addStyle(gridcss);
		GM_addStyle(gridcss2);

		GM_addStyle(".cellIcon img { width: 20px }");
		GM_addStyle(".jsgrid-cell { white-space: pre-wrap; overflow-x: hidden; }");
		GM_addStyle("a {color: inherit;}");
	}

	function replaceGrid(jsgridData) {
		$("#grid1").removeData('igGrid');
		$("#ConteneurListes").empty();
		$("#ConteneurListes").append( "<div id='grid1'></div>" );

		$("#grid1").jsGrid(jsgridData);
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
		console.log(parsedData.data);
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
			}
		});

		jsGridParams.fields = fields;

		return jsGridParams;
	}

	function parseOGGridData(gridData) {
		var listLieupost = [""];
		var listEnrt = [""];
		var returnDict = {};

		gridData.forEach(function(record){
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
		});

		returnDict.data = gridData;
		returnDict.lieux = listLieupost;
		returnDict.employeurs = listEnrt;
		return returnDict;
	}

	loadCSS();
	var jsGridParams = gridDataToJSGrid($("#grid1").data("igGrid").dataSource.settings);
	replaceGrid(jsGridParams);
})();