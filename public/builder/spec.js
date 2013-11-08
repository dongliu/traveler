(function () {
var root = this, exports = {};

// The jade runtime:
var jade = exports.jade=function(exports){Array.isArray||(Array.isArray=function(arr){return"[object Array]"==Object.prototype.toString.call(arr)}),Object.keys||(Object.keys=function(obj){var arr=[];for(var key in obj)obj.hasOwnProperty(key)&&arr.push(key);return arr}),exports.merge=function merge(a,b){var ac=a["class"],bc=b["class"];if(ac||bc)ac=ac||[],bc=bc||[],Array.isArray(ac)||(ac=[ac]),Array.isArray(bc)||(bc=[bc]),ac=ac.filter(nulls),bc=bc.filter(nulls),a["class"]=ac.concat(bc).join(" ");for(var key in b)key!="class"&&(a[key]=b[key]);return a};function nulls(val){return val!=null}return exports.attrs=function attrs(obj,escaped){var buf=[],terse=obj.terse;delete obj.terse;var keys=Object.keys(obj),len=keys.length;if(len){buf.push("");for(var i=0;i<len;++i){var key=keys[i],val=obj[key];"boolean"==typeof val||null==val?val&&(terse?buf.push(key):buf.push(key+'="'+key+'"')):0==key.indexOf("data")&&"string"!=typeof val?buf.push(key+"='"+JSON.stringify(val)+"'"):"class"==key&&Array.isArray(val)?buf.push(key+'="'+exports.escape(val.join(" "))+'"'):escaped&&escaped[key]?buf.push(key+'="'+exports.escape(val)+'"'):buf.push(key+'="'+val+'"')}}return buf.join(" ")},exports.escape=function escape(html){return String(html).replace(/&(?!(\w+|\#\d+);)/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")},exports.rethrow=function rethrow(err,filename,lineno){if(!filename)throw err;var context=3,str=require("fs").readFileSync(filename,"utf8"),lines=str.split("\n"),start=Math.max(lineno-context,0),end=Math.min(lines.length,lineno+context),context=lines.slice(start,end).map(function(line,i){var curr=i+start+1;return(curr==lineno?"  > ":"    ")+curr+"| "+line}).join("\n");throw err.path=filename,err.message=(filename||"Jade")+":"+lineno+"\n"+context+"\n\n"+err.message,err},exports}({});

// create our folder objects

// checkbox_text.jade compiled template
exports.checkbox_text = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Text</div><div class="controls"><input type="text" name="checkbox_text"/></div></div>');
    return buf.join("");
};

// done.jade compiled template
exports.done = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="controls"><button type="submit" class="btn btn-primary">Done</button></div></div>');
    return buf.join("");
};

// help.jade compiled template
exports.help = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Help</div><div class="controls"><input type="text" name="help"/></div></div>');
    return buf.join("");
};

// hold.jade compiled template
exports.hold = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Holder</div><div class="controls"><input type="text" placeholder="Hold owner" name="holder"/></div></div>');
    return buf.join("");
};

// inputtype.jade compiled template
exports.inputtype = function anonymous(locals) {
    var buf = [];
    buf.push('<option value="checkbox">Checkbox</option><option value="text">Text</option><option value="textarea">Paragraph</option><option value="number">Number</option><option value="choice">Single choice</option><option value="multiple">Miltiple choice</option><option value="upload">Upload file</option><option value="rich">Rich instruction</option><option value="hold">Hold point</option>');
    return buf.join("");
};

// label.jade compiled template
exports.label = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Label</div><div class="controls"><input type="text" name="label"/><span class="help-inline"> Keep the label brief and unique</span></div></div>');
    return buf.join("");
};

// legend.jade compiled template
exports.legend = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Section legend</div><div class="controls"><input type="text" name="legend"/></div></div>');
    return buf.join("");
};

// placeholder.jade compiled template
exports.placeholder = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Placeholder</div><div class="controls"><input type="text" name="placeholder"/></div></div>');
    return buf.join("");
};

// rich_textarea.jade compiled template
exports.rich_textarea = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Rich editor</div><div class="controls"><textarea rows="10" class="tinymce"></textarea></div></div>');
    return buf.join("");
};

// rows.jade compiled template
exports.rows = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Row</div><div class="controls"><input type="text" placeholder="Number of rows" name="rows"/></div></div>');
    return buf.join("");
};

// type.jade compiled template
exports.type = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Type</div><div class="controls"><select><option value="checkbox">Checkbox</option><option value="text">Text</option><option value="textarea">Paragraph</option><option value="number">Number</option><option value="choice">Single choice</option><option value="multiple">Miltiple choice</option><option value="upload">Upload file</option><option value="rich">Rich instruction</option><option value="hold">Hold point</option></select></div></div>');
    return buf.join("");
};

// unit.jade compiled template
exports.unit = function anonymous(locals) {
    var buf = [];
    buf.push('<div class="control-group"><div class="control-label">Unit</div><div class="controls"><input type="text" name="unit"/></div></div>');
    return buf.join("");
};


// attach to window or export with commonJS
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
    module.exports = exports;
} else if (typeof define === "function" && define.amd) {
    define(exports);
} else {
    root.spec = exports;
}

})();