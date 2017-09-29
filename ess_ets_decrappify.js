var records = $("#grid1").data('igGrid').dataSource.settings.dataSource.Records;
records = records.slice(0,4);
extendAllRecords(records).then(console.log);


function extendAllRecords(recordList) {
	// Caution : Might make the servers catch fire if run
	
	var fakeDoc = initShadowDOM();
	
	return records.reduce(function(promiseAccumulator, record) {
		return promiseAccumulator.then(function(extendedRecords){
			return extendRecord(record, fakeDoc).then(function(extendedRecord) {
				extendedRecords.push(extendedRecord);
				return extendedRecords;
			});
		})
	}, Promise.resolve([]));
}

function extendRecord(record, fakeDoc) {
	// Defensive copy, we're not altering the original
	record = Object.assign({}, record);
	
	var jqPromise = $.get("https://see.etsmtl.ca/Poste/" + record["GuidString"]).then(function(pageHtml) {
		pageHtml = $.trim(pageHtml);
		var jqObj = $(pageHtml, fakeDoc);
		
		record.desc = jqObj.find(".divBoiteBleu").text().trim();
		record.extraInfo = detailsToKeys(jqObj);
		
		// Only body really needs to be cleared between parses.
		$(fakeDoc).find("body").empty();
		
		return record;
	});
	
	return new Promise(function(resolve, reject) { jqPromise.then(resolve, reject) })
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
	}, {})
}

function initShadowDOM() {
	// Create shadow DOM (Mirorring jQuery's internal implementation)
	// https://github.com/jquery/jquery/blob/2d4f53416e5f74fa98e0c1d66b6f3c285a12f0ce/src/core/parseHTML.js#L32
	context = document.implementation.createHTMLDocument( "" );

	// Set the base href for the created document
	// so any parsed elements with URLs
	// are based on the document's URL (gh-2965)
	base = context.createElement( "base" );
	base.href = document.location.href;
	context.head.appendChild( base );
	
	return context;
}