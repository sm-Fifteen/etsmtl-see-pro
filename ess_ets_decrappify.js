var records = $("#grid1").data('igGrid').dataSource.settings.dataSource.Records;

// Caution : Will probably catch fire or make the servers catch fire if run
records.reduce(function(promiseAccumulator, record) {
	return promiseAccumulator.then(function(extendedRecords){
		return extendRecord(record).then(function(extendedRecord) {
			extendedRecords.push(extendedRecord);
			return extendedRecords;
		});
	})
}, Promise.resolve([]));

function extendRecord(record) {
	// Defensive copy, we're not altering the original
	record = Object.assign({}, record);
	
	var jqPromise = $.get("https://see.etsmtl.ca/Poste/" + record["GuidString"]).then(function(pageHtml) {
		pageHtml = $.trim(pageHtml);
		var jqObj = $(pageHtml);
		
		record.desc = jqObj.find(".divBoiteBleu").text().trim();
		record.extraInfo = detailsToKeys(jqObj);
		
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