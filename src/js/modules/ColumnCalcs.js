//public calc object
var CalcComponent = function (row){
	this._row = row;
};

CalcComponent.prototype.getData = function(transform){
	return this._row.getData(transform);
};

CalcComponent.prototype.getElement = function(){
	return this._row.getElement();
};

CalcComponent.prototype.getTable = function(){
	return this._row.table;
};

CalcComponent.prototype.getCells = function(){
	var cells = [];

	this._row.getCells().forEach(function(cell){
		cells.push(cell.getComponent());
	});

	return cells;
};

CalcComponent.prototype.getCell = function(column){
	var cell = this._row.getCell(column);
	return cell ? cell.getComponent() : false;
};

CalcComponent.prototype._getSelf = function(){
	return this._row;
};

import Module from '../module.js';

class ColumnCalcs extends Module{

	constructor(table){
		super(table);

		this.topCalcs = [];
		this.botCalcs = [];
		this.genColumn = false;
		this.topElement = this.createElement();
		this.botElement = this.createElement();
		this.topRow = false;
		this.botRow = false;
		this.topInitialized = false;
		this.botInitialized = false;

		this.initialize();
	}

	createElement (){
		var el = document.createElement("div");
		el.classList.add("tabulator-calcs-holder");
		return el;
	}

	initialize(){
		this.genColumn = new Column({field:"value"}, this);
	}

	//dummy functions to handle being mock column manager
	registerColumnField(){};

	//initialize column calcs
	initializeColumn(column){
		var def = column.definition

		var config = {
			topCalcParams:def.topCalcParams || {},
			botCalcParams:def.bottomCalcParams || {},
		};

		if(def.topCalc){

			switch(typeof def.topCalc){
				case "string":
				if(this.calculations[def.topCalc]){
					config.topCalc = this.calculations[def.topCalc]
				}else{
					console.warn("Column Calc Error - No such calculation found, ignoring: ", def.topCalc);
				}
				break;

				case "function":
				config.topCalc = def.topCalc;
				break

			}

			if(config.topCalc){
				column.modules.columnCalcs = config;
				this.topCalcs.push(column);

				if(this.table.options.columnCalcs != "group"){
					this.initializeTopRow();
				}
			}

		}

		if(def.bottomCalc){
			switch(typeof def.bottomCalc){
				case "string":
				if(this.calculations[def.bottomCalc]){
					config.botCalc = this.calculations[def.bottomCalc]
				}else{
					console.warn("Column Calc Error - No such calculation found, ignoring: ", def.bottomCalc);
				}
				break;

				case "function":
				config.botCalc = def.bottomCalc;
				break

			}

			if(config.botCalc){
				column.modules.columnCalcs = config;
				this.botCalcs.push(column);

				if(this.table.options.columnCalcs != "group"){
					this.initializeBottomRow();
				}
			}
		}

	}

	removeCalcs(){
		var changed = false;

		if(this.topInitialized){
			this.topInitialized = false;
			this.topElement.parentNode.removeChild(this.topElement);
			changed = true;
		}

		if(this.botInitialized){
			this.botInitialized = false;
			this.table.footerManager.remove(this.botElement);
			changed = true;
		}

		if(changed){
			this.table.rowManager.adjustTableSize();
		}
	}

	initializeTopRow(){
		if(!this.topInitialized){
			this.table.columnManager.getElement().insertBefore(this.topElement, this.table.columnManager.headersElement.nextSibling);
			this.topInitialized = true;
		}
	}

	initializeBottomRow(){
		if(!this.botInitialized){
			this.table.footerManager.prepend(this.botElement);
			this.botInitialized = true;
		}
	}


	scrollHorizontal(left){
		if(this.botInitialized && this.botRow){
			this.botRow.getElement().style.marginLeft = (-left) + "px";
		}
	}


	recalc(rows){
		var data, row;

		if(this.topInitialized || this.botInitialized){
			data = this.rowsToData(rows);

			if(this.topInitialized){
				if(this.topRow){
					this.topRow.deleteCells();
				}

				row = this.generateRow("top", this.rowsToData(rows))
				this.topRow = row;
				while(this.topElement.firstChild) this.topElement.removeChild(this.topElement.firstChild);
				this.topElement.appendChild(row.getElement());
				row.initialize(true);
			}

			if(this.botInitialized){
				if(this.botRow){
					this.botRow.deleteCells();
				}

				row = this.generateRow("bottom", this.rowsToData(rows))
				this.botRow = row;
				while(this.botElement.firstChild) this.botElement.removeChild(this.botElement.firstChild);
				this.botElement.appendChild(row.getElement());
				row.initialize(true);
			}

			this.table.rowManager.adjustTableSize();

			//set resizable handles
			if(this.table.modExists("frozenColumns")){
				this.table.modules.frozenColumns.layout();
			}
		}
	}

	recalcRowGroup(row){
		this.recalcGroup(this.table.modules.groupRows.getRowGroup(row));
	}

	recalcAll(){
		if(this.topCalcs.length || this.botCalcs.length){
			if(this.table.options.columnCalcs !== "group"){
				this.recalc(this.table.rowManager.activeRows);
			}

			if(this.table.options.groupBy && this.table.options.columnCalcs !== "table"){


				var groups = table.modules.groupRows.getChildGroups();

				groups.forEach((group) => {
					this.recalcGroup(group);
				});
			}
		}
	}

	recalcGroup(group){
		var data, rowData;

		if(group){
			if(group.calcs){
				if(group.calcs.bottom){
					data = this.rowsToData(group.rows);
					rowData = this.generateRowData("bottom", data);

					group.calcs.bottom.updateData(rowData);
					group.calcs.bottom.reinitialize();
				}

				if(group.calcs.top){
					data = this.rowsToData(group.rows);
					rowData = this.generateRowData("top", data);

					group.calcs.top.updateData(rowData);
					group.calcs.top.reinitialize();
				}
			}
		}
	}



	//generate top stats row
	generateTopRow(rows){
		return this.generateRow("top", this.rowsToData(rows));
	}
	//generate bottom stats row
	generateBottomRow(rows){
		return this.generateRow("bottom", this.rowsToData(rows));
	}

	rowsToData(rows){
		var data = [];

		rows.forEach((row) => {
			data.push(row.getData());

			if(this.table.options.dataTree && this.table.options.dataTreeChildColumnCalcs){
				if(row.modules.dataTree.open){
					var children = this.rowsToData(this.table.modules.dataTree.getFilteredTreeChildren(row));
					data = data.concat(children);
				}
			}
		});

		return data;
	}

	//generate stats row
	generateRow(pos, data){
		var self = this,
		rowData = this.generateRowData(pos, data),
		row;

		if(self.table.modExists("mutator")){
			self.table.modules.mutator.disable();
		}

		row = new Row(rowData, this, "calc");

		if(self.table.modExists("mutator")){
			self.table.modules.mutator.enable();
		}

		row.getElement().classList.add("tabulator-calcs", "tabulator-calcs-" + pos);

		row.component = false;

		row.getComponent = function(){
			if(!this.component){
				this.component = new CalcComponent(this);
			}

			return this.component;
		};

		row.generateCells = function(){

			var cells = [];

			self.table.columnManager.columnsByIndex.forEach(function(column){

					//set field name of mock column
					self.genColumn.setField(column.getField());
					self.genColumn.hozAlign = column.hozAlign;

					if(column.definition[pos + "CalcFormatter"] && self.table.modExists("format")){
						self.genColumn.modules.format = {
							formatter: self.table.modules.format.getFormatter(column.definition[pos + "CalcFormatter"]),
							params: column.definition[pos + "CalcFormatterParams"] || {},
						};
					}else{
						self.genColumn.modules.format = {
							formatter: self.table.modules.format.getFormatter("plaintext"),
							params:{}
						};
					}

					//ensure css class defintion is replicated to calculation cell
					self.genColumn.definition.cssClass = column.definition.cssClass;

					//generate cell and assign to correct column
					var cell = new Cell(self.genColumn, row);
					cell.getElement();
					cell.column = column;
					cell.setWidth();

					column.cells.push(cell);
					cells.push(cell);

					if(!column.visible){
						cell.hide();
					}
				});

			this.cells = cells;
		};

		return row;
	}

	//generate stats row
	generateRowData(pos, data){
		var rowData = {},
		calcs = pos == "top" ? this.topCalcs : this.botCalcs,
		type = pos == "top" ? "topCalc" : "botCalc",
		params, paramKey;

		calcs.forEach(function(column){
			var values = [];

			if(column.modules.columnCalcs && column.modules.columnCalcs[type]){
				data.forEach(function(item){
					values.push(column.getFieldValue(item));
				});

				paramKey = type + "Params";
				params = typeof column.modules.columnCalcs[paramKey] === "function" ? column.modules.columnCalcs[paramKey](values, data) : column.modules.columnCalcs[paramKey];

				column.setFieldValue(rowData, column.modules.columnCalcs[type](values, data, params));
			}
		});

		return rowData;
	}

	hasTopCalcs(){
		return	!!(this.topCalcs.length);
	}

	hasBottomCalcs(){
		return	!!(this.botCalcs.length);
	}

	//handle table redraw
	redraw(){
		if(this.topRow){
			this.topRow.normalizeHeight(true);
		}
		if(this.botRow){
			this.botRow.normalizeHeight(true);
		}
	}

	//return the calculated
	getResults(){
		var self = this,
		results = {},
		groups;

		if(this.table.options.groupBy && this.table.modExists("groupRows")){
			groups = this.table.modules.groupRows.getGroups(true);

			groups.forEach(function(group){
				results[group.getKey()] = self.getGroupResults(group);
			});
		}else{
			results = {
				top: this.topRow ? this.topRow.getData() : {},
				bottom: this.botRow ? this.botRow.getData() : {},
			}
		}

		return results;
	}

	//get results from a group
	getGroupResults(group){
		var self = this,
		groupObj = group._getSelf(),
		subGroups = group.getSubGroups(),
		subGroupResults = {},
		results = {};

		subGroups.forEach(function(subgroup){
			subGroupResults[subgroup.getKey()] = self.getGroupResults(subgroup);
		});

		results = {
			top: groupObj.calcs.top ? groupObj.calcs.top.getData() : {},
			bottom: groupObj.calcs.bottom ? groupObj.calcs.bottom.getData() : {},
			groups: subGroupResults,
		}

		return results;
	}
}

//default calculations
ColumnCalcs.prototype.calculations = {
	"avg":function(values, data, calcParams){
		var output = 0,
		precision = typeof calcParams.precision !== "undefined" ? calcParams.precision : 2

		if(values.length){
			output = values.reduce(function(sum, value){
				return Number(sum) + Number(value);
			});

			output = output / values.length;

			output = precision !== false ? output.toFixed(precision) : output;
		}

		return parseFloat(output).toString();
	},
	"max":function(values, data, calcParams){
		var output = null,
		precision = typeof calcParams.precision !== "undefined" ? calcParams.precision : false;

		values.forEach(function(value){

			value = Number(value);

			if(value > output || output === null){
				output = value;
			}
		});

		return output !== null ? (precision !== false ? output.toFixed(precision) : output) : "";
	},
	"min":function(values, data, calcParams){
		var output = null,
		precision = typeof calcParams.precision !== "undefined" ? calcParams.precision : false;

		values.forEach(function(value){

			value = Number(value);

			if(value < output || output === null){
				output = value;
			}
		});

		return output !== null ? (precision !== false ? output.toFixed(precision) : output) : "";
	},
	"sum":function(values, data, calcParams){
		var output = 0,
		precision = typeof calcParams.precision !== "undefined" ? calcParams.precision : false;

		if(values.length){
			values.forEach(function(value){
				value = Number(value);

				output += !isNaN(value) ? Number(value) : 0;
			});
		}

		return precision !== false ? output.toFixed(precision) : output;
	},
	"concat":function(values, data, calcParams){
		var output = 0;

		if(values.length){
			output = values.reduce(function(sum, value){
				return String(sum) + String(value);
			});
		}

		return output;
	},
	"count":function(values, data, calcParams){
		var output = 0;

		if(values.length){
			values.forEach(function(value){
				if(value){
					output ++;
				}
			});
		}

		return output;
	},
};

// Tabulator.prototype.registerModule("columnCalcs", ColumnCalcs);

module.exports = ColumnCalcs;