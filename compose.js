const places = "1234567890ET";
//complib api url for getting methods
var url = "https://api.complib.org/";
//holder for svg stuff
var svg;
//holder of plain course
var rowarr = [];

//stage of method from complib
var stage;
var numbells;
var tenor;

//store info: leadlength, leadhead, leadend, pborder, fcourses
var methodinfo = {};
//compinfo.courses, compinfo.leads - both indexes of things in use and/or false
var compinfo = {};
//holder of all the course orders for the stage
var courseorders;
//course order in source material that has been clicked on
var selectedco;
//leadhead in source material that has been clicked on - attempting not to use this anymore
var selectedlh;
//clicked leadheads in source material
var lhstoadd = [];
//leadhead in workspace that has been clicked on
var activelh;
//leadheads that can come directly after activelh
var nextavailable;
//results from row search field
var searchresults = {};

var calltype = "near";
//table cell being hovered over that could receive the current activelh
//hmmm could I just highlight these for touchscreens
var gridtarget;
// plain, bob, or single, if activelh goes into gridtarget
var connection;

$(function() {
  $("#composition").svg({onLoad: (o) => {
    svg = o;
    svg.configure({xmlns: "http://www.w3.org/2000/svg", "xmlns:xlink": "http://www.w3.org/1999/xlink", width: 0, height: 0});
  }});
  $("#submit").on("click", subcomplib);
  //source material
  $("#courseorders").on("click", "li", courseorderclick);
  $("#leadheads").on("click", "li", leadheadclick);
  $("#addtoworkspace").on("click", addtoworkspace);
  //workspace
  $("#chosenleads").on("click", "li", worklhclick);
  $("#workspacegrid").on("mouseenter", "td.column1", worktablehover);
  $("#workspacegrid").on("mouseleave", "td.column1", worktableleave);
  $("#workspacegrid").on("click", "td.column1", worktableclick);
  $("#workspacegrid").on("click", ".removelh", removelhclick);
  $("#searchbutton").on("click", handlesearchbar);
});

//submit a complib method id
function subcomplib() {
  //clear previous stuff
  $("#rowcolumn,#catcolumn,#courseorders,#chosenleads ul").contents().detach();
  $("h2,#numberadded").text("");
  methodinfo = {};
  compinfo = {};
  courseorders = [];
  let num = $("#complibid").val();
  if (num.length > 4 && /^\d+$/.test(num)) {
    getcomplib(num);
  }
}

//results of complib method rows
let example = {
  id: Number,
  library: ["CCCBR", "Provisional"],
  title: "method title",
  name: "method name",
  placeNotation: "supposedly in a cccbr format",
  stage: Number,
  divisionEnds: [Number],
  rows: [["row", "spoken call", "row analysis flags"]]
};
function getcomplib(mid) {
  var xhr = new XMLHttpRequest();
  
  xhr.open('GET', url+"method/"+mid+"/rows", true);
  xhr.send();
  
  xhr.onload = function() {
    let results = JSON.parse(xhr.responseText);
    rowarr = [];
    
    if (results.rows) {
      stage = results.stage;
      //build set of plain bob leadheads for the stage
      let plainlhs = plainleadheads(stage).map(a => rowstring(a));
      let regular;
      //add each row to rowarr (not including rowzero)
      for (let i = 2; i < results.rows.length; i++) {
        let row = results.rows[i][0].split("").map(bellnum);
        rowarr.push(row);
        if (!methodinfo.leadlength && checkbit(results.rows[i][2],4)) {
          //at the first row that has the leadhead flag set, get this info
          methodinfo.leadlength = i-1;
          regular = plainlhs.includes(results.rows[i][0]);
          methodinfo.leadhead = rowstring(row);
          methodinfo.leadend = results.rows[i-1][0];
          leadorder(row);
          //;
          //console.log(nextleads(row));
        }
        
      }
      if (![6,7,8].includes(stage) || !regular) {
        $("#courseorders").append(`<p>Can't work with ${results.title} yet</p>`);
      } else {
        $("h2").text(results.title);
        $.get("courseorder"+stage+".json", function(body) {
          courseorders = body;
          //console.log(courseorders.length);
          //console.log(courseorders[0]);
          methodinfo.fcourses = findfalseagain();
          //console.log(methodinfo.fcourses);
          //console.log(findfalseagain());
          setuptools();
        });
      }
    }
  }
}

//complib provides rows with a number representing 16 flags (only it's not a number, it's a string!!!!)
//check if a particular flag is set
function checkbit(value, bit) {
  let num = Number(value);
  let pow = Math.pow(2, bit);
  let d = Math.floor(num/pow);
  return d % 2 === 1;
}

//mark starting course order as in use and find courses false against it
//add course orders to display
function setuptools() {
  let cos = [6,7].includes(stage) ? courseorders : courseorders.filter(o => o.incourse === true && o.tentogether === true);
  //console.log(cos[0]);
  compinfo.courses = {};
  compinfo.leads = {};
  compinfo.courses[rowstring(cos[0].co)] = ["inuse"];
  compinfo.leads[places.slice(0,stage)] = ["inuse"];
  let fleads = getfalsefromlead(places.slice(0,stage).split("").map(bellnum));
  fleads.forEach(o => {
    compinfo.courses[rowstring(o.co)] = ["false"];
    compinfo.leads[o.lh] = ["false"];
  });
  let html = `<ul>
  <li id="c${rowstring(cos[0].co)}" class="inuse">${rowstring(cos[0].co)}</li>
  `;
  for (let i = 1; i < cos.length; i++) {
    let co = cos[i];
    let costr = rowstring(co.co);
    let c = "";
    if (compinfo.courses[costr]) {
      //should only result in class="false"
      c = ` class="${compinfo.courses[costr].join(" ")}"`;
    }
    html += `<li${c} id="c${costr}">${costr}</li>
    `;
  }
  html += `</ul>`;
  $("#courseorders").append(html);
  let rounds = places.slice(0,stage);
  $("#chosenleads ul").append(`<li id="al${rounds}">${rowstring(cos[0].co)}: ${rounds}</li>`);
  $("#numberadded").text(methodinfo.leadlength + " rows");
  for (let r = 1; r <= 16; r++) {
    addrows();
  }
  $("#workinglist").append(`<button id="addrows">+</button>`);
  $("#addrows").on("click", addrows);
  $("#searchbar").removeClass("hidden");
}

//add empty rows to worktable
function addrows(e) {
  //console.log("add rows click");
  let r = $("#workspacegrid tr").length+1;
  let trow = `<tr>`;
  let tr = `<tr id="r${r}">`;
  let clas = ["callcol","cocol","numcol"];
  for (let c = 0; c <= 2; c++) {
    let cl = c === 1 ? ` class="column1"` : "";
    trow += `<td id="r${r}c${c}"${cl}></td>`;
    tr += `<td class="${clas[c-1]}"></td>`;
  }
  trow += `</tr>`;
  tr += `</tr>`;
  $("#workspacegrid").append(trow);
  //$("#comptable").append(tr);
}
//no idea what this was for? testing?
function tablerelease(e) {
  console.log(e.currentTarget.id);
}

//have to hover before click 
//add activelh to composition table
function worktableclick(e) {
  if (gridtarget === e.currentTarget.id) {
    let id = gridtarget.slice(0,-1) + "2";
    $("#"+id).text("x");
    $("#"+id).addClass("removelh");
    $(e.currentTarget).text(activelh);
    $(e.currentTarget).css("background-color", "white");
    if (connection != "plain") {
      let cid = id.slice(0,-1) + "0";
      let text = connection[0] === "b" ? "-" : "s";
      $("#"+cid).text(text);
    }
  }
}

//remove a lh from worktable
function removelhclick(e) {
  $(e.currentTarget).removeClass("removelh");
  $(e.currentTarget).parent().children().text("");
}

//check if a lh can be added to a worktable cell
function worktablehover(e) {
  //if a workspace lh is selected and the table cell is blank
  if (activelh && $(e.currentTarget).text().length === 0) {
    //figure out if activelh can connect to surrounding cells
    let trow = Number(e.currentTarget.id.slice(1,-2));
    let before;
    let after;
    if (trow === 1) {
      before = true;
      connection = "plain";
    } else {
      let prev = ["#","r",trow-1,"c1"].join("");
      if ($(prev).text().length === 0) {
        before = true;
        connection = "plain";
      } else {
        let blh = $(prev).text().split("").map(bellnum);
        let next = nextleads(blh);
        console.log(next);
        connection = Object.keys(next).find(key => rowstring(next[key]) === activelh);
        if (connection) {
          before = true;
        }
      }
    }
    let below = ["#r",trow+1,"c1"].join("");
    if (!$(below) || $(below).text().length === 0 || nextavailable.includes($(below).text())) {
      after = true;
    }
    //if the composition would work, shade the table cell
    if (before && after) {
      gridtarget = e.currentTarget.id;
      $(e.currentTarget).css({cursor: "pointer", "background-color": "lightblue"});
    } else {
      gridtarget = null;
      connection = null;
    }
    
  }
}
function worktableleave(e) {
  gridtarget = null;
  connection = null;
  $(e.currentTarget).css("background-color", "white");
}


//in source material
//display the leadheads in that course order
function courseorderclick(e) {
  if (!$(e.currentTarget).hasClass("selected")) {
    selectedlh = null;
    lhstoadd = [];
    $("#leadinfo").children().remove();
    $("#addtoworkspace").addClass("disabled");
    $("#courseorders li.selected").removeClass("selected");
    $(e.currentTarget).addClass("selected");
    $("#leadheads").contents().detach();
    let costr = $(e.currentTarget).text();
    selectedco = costr;
    let co = costr.split("").map(bellnum);
    let homestr = rowstring(homecourseorder(stage));
    let leads = [];
    //might be easier not to do this one differently???
    if (costr === homestr) {
      let plain = plainleadheads(stage);
      leads.push(places.slice(0,stage).split("").map(bellnum));
      let pb = methodinfo.pborder;
      for (let i = 1; i < pb.length; i++) {
        let lead = plain.find(l => l.indexOf(stage)+1 === pb[i]);
        leads.push(lead);
      }
    } else {
      leads = getlhsfromco(co);
    }
    let html = `<ul>
    `;
    leads.forEach(l => {
      let s = rowstring(l);
      let cl = [];
      if (nextavailable && nextavailable.includes(s)) {
        cl.push("close");
      }
      if (searchresults[costr] && searchresults[costr][s]) {
        cl.push("hasrow");
      }
      if (compinfo.leads[s]) {
        cl.push(...compinfo.leads[s]);
      }
      let c = cl.length ? ` class="${cl.join(" ")}"` : "";
      html += `<li${c} id="l${s}">${s}</li>
      `;
    });
    html += `</ul>`;
    $("#leadheads").append(html);
  }
}

//in source material
function leadheadclick(e) {
  //console.log(e.shiftKey);
  document.getSelection().removeAllRanges();
  let lh = $(e.currentTarget).text();
  $("#leadinfo").children().remove();
  if (!$(e.currentTarget).hasClass("inuse")) {
    $("#addtoworkspace").removeClass("disabled");
    if (e.shiftKey) {
      if (!lhstoadd.includes(lh)) lhstoadd.push(lh);
    } else {
      lhstoadd = [$(e.currentTarget).text()];
      $("#leadheads li.selected").removeClass("selected");
    }
    $(e.currentTarget).addClass("selected");
  }
  if ($(e.currentTarget).hasClass("hasrow")) {
    let rows = searchresults[selectedco][lh];
    displaysearch(rows);
  }
  
}

//add items in lhstoadd (from source material) to workspace
function addtoworkspace(e) {
  if (!$(e.currentTarget).hasClass("disabled")) {
    $(e.currentTarget).addClass("disabled");
    lhstoadd.forEach(selectedlh => {
      let lh = selectedlh.split("").map(bellnum);
      let co = getcofromlh(lh);
      let costr = rowstring(co);
      //update compinfo and classes in source material
      if (!compinfo.courses[costr]) {
        compinfo.courses[costr] = ["inuse"];
        $("#c"+costr).addClass("inuse");
      } else if (!compinfo.courses[costr].includes("inuse")) {
        compinfo.courses[costr].push("inuse");
        $("#c"+costr).addClass("inuse");
      }
      if (!compinfo.leads[selectedlh]) {
        compinfo.leads[selectedlh] = ["inuse"];
        $("#l"+selectedlh).addClass("inuse");
      }
      //actually add to workspace
      $("#chosenleads ul").append(`<li id="al${selectedlh}">${costr}: ${selectedlh}</li>`);
      let num = $("#chosenleads li").length * methodinfo.leadlength;
      $("#numberadded").text(`${num} rows`);
      //update falseness in compinfo and source material display
      let fleads = getfalsefromlead(lh);
      //console.log(fleads);
      fleads.forEach(o => {
        let s = rowstring(o.co);
        if (!compinfo.courses[s]) {
          compinfo.courses[s] = ["false"];
          $("#c"+s).addClass("false");
        } else if (!compinfo.courses[s].includes("false")) {
          compinfo.courses[s].push("false");
          $("#c"+s).addClass("false");
        }
        if (!compinfo.leads[o.lh]) {
          compinfo.leads[o.lh] = ["false"];
        } else if (!compinfo.leads[o.lh].includes("false")) {
          compinfo.leads[o.lh].push("false");
        }
  
      });
    //console.log(compinfo.leads);
    });
  }
  
}

//click on a leadhead in the workspace (not in table)
function worklhclick(e) {
  clearsearch();
  $("#chosenleads li.selected").removeClass("selected");
  $("li.close").removeClass("close");
  $(e.currentTarget).addClass("selected");
  activelh = e.currentTarget.id.slice(2);
  //figure out leadheads that can come next
  let next = nextleads(activelh.split("").map(bellnum));
  nextavailable = [];
  ["plain", "b14"].forEach(key => {
    nextavailable.push(rowstring(next[key]));
  });
  //singles only allowed on minor (currently)
  if (stage === 6) {
    let key = calltype === "near" ? "s1234" : "s1456";
    nextavailable.push(rowstring(next[key]));
  }
  //highlight next in workspace and source course orders
  nextavailable.forEach(r => {
    if ($("#al"+r).length) {
      $("#al"+r).addClass("close");
    } else {
      if ($("#l"+r).length) $("#l"+r).addClass("close");
      let co = getcofromlh(r.split("").map(bellnum));
      //console.log(co);
      let costr = rowstring(co);
      $("li#c"+costr).addClass("close");
    }
  });
}

function clearworkselection() {
  activelh = null;
  nextavailable = [];
  gridtarget = null;
  connection = null;
  
  ["selected", "close", "false"].forEach(c => {
    $("#chosenleads li."+c).removeClass(c);
  });
  $("#sourcematerial li.close").removeClass("close");
}

function clearsearch() {
  searchresults = {};
  $("li.hasrow").removeClass("hasrow");
  $("#leadinfo").children().remove();
}

//idea: allow searching for a string shorter than the stage? flexible location in row
function handlesearchbar(e) {
  clearworkselection();
  clearsearch();
  $("#searchbar p").remove();
  let text = $("#search").val();
  let problem;
  let patterns = [text];

  if (text.length < stage) {
    //currently invalid
    problem = "search doesn't match stage";
  } else if (/[^\dxet\(\)]/.test(text)) {
    problem = "invalid character in search";
  } else if (text.includes("(") || text.includes(")")) {
    patterns = handlepatterns(text);
    if (patterns.length === 0) problem = "problem with parentheses";
  }
  if (problem) {
    $("#searchbar").append(`<p>${problem}</p>`);
  } else {
    let cocount = 0;
    let rowcount = 0;
    let res = {};
    patterns.forEach(p => {
      let rows = getrowsfrompattern(p);
      //need to get lhs and cos from each row
      rows.forEach(r => {
        let set = getbothfromrow(r);
        for (let lh in set) {
          let co = set[lh];
          
          if (res[co]) {
            if (res[co][lh]) {
              res[co][lh].push(rowstring(r));
            } else {
              res[co][lh] = [rowstring(r)];
            }
          } else {
            res[co] = {};
            res[co][lh] = [rowstring(r)];
          }
        }
      });
    });

    for (let co in res) {
      let found = $("#c"+co).length;
      if (found) {
        searchresults[co] = res[co];
        cocount++;
        for (let lh in res[co]) {
          rowcount += res[co][lh].length;
          if ($("#al"+lh).length) {
            $("#al"+lh).addClass("hasrow");
          }
          if ($("#l"+lh).length) $("#l"+lh).addClass("hasrow");
          $("li#c"+co).addClass("hasrow");
          if (lhstoadd.length === 1 && lhstoadd.includes(lh)) {
            displaysearch(res[co][lh]);
          }
        }
      }
    }
    if (cocount === 0) {
      $("#searchbar").append(`<p>row not available</p>`);
    }
    console.log("rows available: "+rowcount);
  }
}

//given some rows, display them in the source material info section
//I want the rows to be strings
function displaysearch(rows) {
  let html = `<p>Rows matching search in this lead:</p>
  <ul>
  `;
  rows.forEach(r => {
    html += `<li>${r}</li>
    `;
  });
  html += `</ul>`;
  $("#leadinfo").append(html);
}

//BELLRINGING FUNCTIONS

//convert bell characters to numbers
function bellnum(n) {
  switch (n) {
    case "0":
      return 10;
      break;
    case "E":
      return 11;
      break;
    case "T":
      return 12;
      break;
    default:
      return Number(n);
  }
}

//convert array of bell numbers to string of characters
function rowstring(arr) {
  let r = arr.map(n => {
    switch (n) {
      case 10:
        return "0";
        break;
      case 11:
        return "E";
        break;
      case 12:
        return "T";
        break;
      default:
        return n;
    }
  });
  return r.join("");
}

//build plain bob course order
//does not include tenor
function homecourseorder(stage) {
  let home = [];
  for (let b = 2; b < stage; b+=2) {
    home.push(b);
    home.unshift(b+1);
  }
  return home;
}

//co should be an array
function buildcourse(co) {
  let home = homecourseorder(stage);
  let course = [];
  for (let i = 0; i < rowarr.length; i++) {
    let old = rowarr[i];
    let row = [];
    for (let p = 0; p < stage; p++) {
      if ([1,stage].includes(old[p])) {
        row.push(old[p])
      } else {
        let b = old[p];
        let j = home.indexOf(b);
        row.push(co[j]);
      }
    }
    course.push(row);
  }
  return course;
}

//build plain bob leadheads for stage n
//does not include rounds??
function plainleadheads(n) {
  let lhs = [];
  let co = homecourseorder(n);
  co.unshift(n);
  for (let i = 0; i < n-2; i++) {
    let row = [1];
    for (let b = 2; b <= n; b++) {
      let j = co.indexOf(b);
      let k = j - i - 1;
      if (k < 0) k = co.length + k;
      row.push(co[k]);
    }
    lhs.push(row);
  }
  return lhs;
}

//compare rows of course against rowarr
function comparecourse(course) {
  //build index, key is row from rowarr, value is row number in rowarr
  let dex = {};
  for (let i = 0; i < rowarr.length; i++) {
    let str = rowstring(rowarr[i]);
    dex[str] = i+1;
  }
  //check if each row of course is in dex
  //dice has arrays with two numbers: index of a row in rowarr, index of same row in course
  let dice = [];
  for (let i = 0; i < course.length; i++) {
    let str = rowstring(course[i]);
    let n = dex[str];
    if (n) {
      dice.push([n-1, i]);
    }
  }
  return dice;
}

//find bits false against the plain course
//maybe without unnecessary steps??
function findfalseagain() {
  let home = rowstring(homecourseorder(stage));
  let cc = [];
  let otherc = [];
  let cstrings = [];
  for (let i = 0; i < rowarr.length; i++) {
    let r = rowarr[i];
    let aa = findcofromrow(r);
    let plaincount = 0;
    aa.forEach(a => {
      let s = rowstring(a);
      let o = courseorders.find(obj => rowstring(obj.co) === s);
      if (s === home) {
        plaincount++;
      } else if (!cstrings.includes(s)) {
        cstrings.push(s);
        if (o.incourse && o.tentogether) {
          cc.push(a);
        } else {
          otherc.push({co: s, count: 1});
        }
      } else if (!o.incourse || !o.tentogether) {
        let other = otherc.find(obj => obj.co === s);
        other.count++;
      }
    });
    if (plaincount > 1) console.log("falseness in plain course??");
  }
  //console.log(otherc);
  let sum = 0;
  otherc.forEach(o => sum += o.count);
  //console.log(sum + " rows in otherc");
  return buildfalse(cc);
}



//let's say r is an array
function getlhsfromrow(r) {
  let trebleplace = r.indexOf(1);
  let lhs = [];
  for (let i = 0; i < methodinfo.leadlength; i++) {
    if (rowarr[i].indexOf(1) === trebleplace) {
      let lh = [1];
      for (let b = 2; b <= stage; b++) {
        let p = rowarr[i].indexOf(b);
        lh.push(r[p]);
      }
      lhs.push(lh);
    }
  }
  return lhs;
}

//co and lh
//row r is array
//return obj with lh keys and co values
function getbothfromrow(r) {
  let lhs = getlhsfromrow(r);
  let res = {};
  lhs.forEach(a => {
    let co = getcofromlh(a);
    res[rowstring(a)] = rowstring(co);
  });
  return res;
}


function buildfalse(cos) {
  //for each course order
  //build the course
  //comparecourse(course)
  let leadlength = methodinfo.leadlength;
  let extra = 0;
  let fcourses = [];
  for (let i = 0; i < cos.length; i++) {
    let co = cos[i];
    let o = courseorders.find(o => rowstring(o.co) === rowstring(co));
    let course = buildcourse(co);
    let f = comparecourse(course);
    if (f.length) {
      let leads = [];
      for (let j = 1; j < stage; j++) {
        let rows = [];
        let lh = j === 1 ? course[course.length-1] : course[j*leadlength-1];
        f.forEach(a => {
          let n = a[1];
          if (n < j*leadlength && n > (j-1)*leadlength-1) {
            rows.push(n-(j-1)*leadlength+1);
          }
        });
        if (rows.length) {
          leads.push({lh: rowstring(lh), rownums: rows});
        }
      }
      fcourses.push({co: co, rownums: f, leads: leads});
      if (o && (!o.incourse || !o.tentogether)) extra++;
    }
  }
  //console.log(extra);
  return fcourses;
}

//old test-them-all version
//specifically false against the plain course
function findfalse() {
  //for each course order
  //build the course
  //comparecourse(course)
  let cos = stage === 6 ? courseorders : courseorders.filter(o => o.incourse === true && o.tentogether === true);
  
  let leadlength = methodinfo.leadlength;
  //console.log("number of course orders to check: "+cos.length);
  let fcourses = buildfalse(cos.slice(1).map(o => o.co));
  return fcourses;
}

//given a coursing order, find the courses that are false against it
function getfalse(co) {
  let fcos = [];
  let home = homecourseorder(stage);
  methodinfo.fcourses.forEach(o => {
    let str = "";
    for (let i = 0; i < co.length; i++) {
      let n = o.co[i];
      let j = home.indexOf(n);
      str += co[j];
    }
    fcos.push(str);
  });
  return fcos;
}

//given a false course order, find its equivalent for the course order co
//doesn't actually have to be false
// plain course : fco :: co : eq
function getfalse2(fco, co) {
  let eq = [];
  let home = homecourseorder(co.length+1);
  for (let i = 0; i < co.length; i++) {
    let b = fco[i];
    let j = home.indexOf(b);
    eq.push(co[j]);
  }
  return eq;
}

//lh must be THE leadhead as an array of numbers
function leadorder(lh) {
  let order = [stage];
  let i = lh.indexOf(stage);
  do {
    order.push(i+1);
    i = lh.indexOf(i+1);
  } while (i != stage-1);
  methodinfo.pborder = order;
}

//lh as array
//returns co without tenor
function getcofromlh(lh) {
  let home = homecourseorder(lh.length);
  home.unshift(lh.length);
  let co = [];
  for (let i = 0; i < home.length; i++) {
    co.push(lh[home[i]-1]);
  }
  
  let rot = rotateco(co,lh.length);
  return rot;
}

//rotate a coursing order to put the tenor first, and remove the tenor
function rotateco(co,n) {
  let i = co.indexOf(n);
  let rot = co.slice(i+1);
  if (i > 0) {
    rot.push(...co.slice(0,i));
  }
  return rot;
}

//get course orders from row
//row array
//assume treble is hunt bell
function findcofromrow(row) {
  let trebleplace = row.indexOf(1);
  let plainrows = rowarr.filter((r,i) => {
    return i < methodinfo.leadlength && r[trebleplace] === 1;
  });
  let home = homecourseorder(stage);
  home.unshift(stage);
  let cos = [];
  for (let i = 0; i < plainrows.length; i++) {
    //get process of row to course order
    let order = [];
    for (let j = 0; j < home.length; j++) {
      order.push(plainrows[i].indexOf(home[j]));
    }
    //apply that process to given row
    let co = [];
    for (let j = 0; j < order.length; j++) {
      co.push(row[order[j]]);
    }
    let rot = rotateco(co, stage);
    cos.push(rot);
  }
  return cos;
}

//input c does not include tenor
function getlhsfromco(c) {
  let plainco = [c.length+2].concat(homecourseorder(c.length+2));
  let co = [c.length+2].concat(c);
  
  let plain = plainleadheads(co.length+1);
  plain.unshift(places.slice(0,co.length+1).split("").map(bellnum));
  //console.log(plain);
  let pb = methodinfo.pborder;
  let lhs = [];
  for (let i = 0; i < pb.length; i++) {
    let home = plain.find(a => a.indexOf(co.length+1)+1 === pb[i]);
    let lh = [1];
    for (let j = 1; j < home.length; j++) {
      let b = home[j];
      let k = plainco.indexOf(b);
      lh.push(co[k]);
    }
    lhs.push(lh);
  }
  return lhs;
}

//lh needs to be an array
function getfalsefromlead(lh) {
  let leadco = getcofromlh(lh);
  
  let results = [];
  let tenorplace = lh.indexOf(stage);
  
  for (let i = 0; i < methodinfo.fcourses.length; i++) {
    let o = methodinfo.fcourses[i];
    let co = getfalse2(o.co, leadco);
    
    let coleads = getlhsfromco(co);
    
    let leads = [];
    for (let j = 0; j < o.leads.length; j++) {
      let lo = o.leads[j];
      let olh = lo.lh.split("").map(bellnum);
      if (olh.indexOf(stage) === tenorplace) {
        let lead = coleads.find(a => a[tenorplace] === stage);
        leads.push(rowstring(lead));
      }
    }
    leads.forEach(n => {
      results.push({co: co, lh: n});
    });
    
  }
  //console.log("result of getfalsefromlead");
    //console.log(results);
  return results;
}



//lh as array
//given a leadhead, build the options for the next leadhead
function nextleads(lh) {
  let next = {};
  let tenorplace = lh.indexOf(stage)+1;
  let mlh = methodinfo.leadhead.split("").map(bellnum);
  let mle = methodinfo.leadend.split("").map(bellnum);
  let plainh = [1];
  let end = [1];
  for (let i = 1; i < lh.length; i++) {
    let bh = mlh[i];
    let be = mle[i];
    plainh.push(lh[bh-1]);
    end.push(lh[be-1]);
  }
  next.plain = plainh;
  let calls = buildcallpns(stage);
  for (let key in calls) {
    next[key] = applypn(end, calls[key]);
  }
  return next;
}

//building far calls but not using them yet
function buildcallpns(n) {
  let calls = {
    b14: [1,4],
    s1234: [1,2,3,4]
  };
  let farcalls = {};
  let farb = [1,n-2];
  farcalls["b"+rowstring(farb)] = farb;
  let fars = [1, n-2, n-1, n];
  farcalls["s"+rowstring(fars)] = fars;
  return calls;
}

var callpos = {5: "V", 6: "X", 7: "S", 8: "E", 9: "N"};
//lh will need to be array of numbers
function getcallname(lh, call) {
  let p = lh.indexOf(stage)+1;
  let name = call === "s" ? "s" : "";
  switch (p) {
    case stage:
      name += "H";
      break;
    case 2:
      //needs updating for far calls????
      name += call === "s" ? "B" : "I";
      break;
    case 3:
      //needs updating for far calls????
      name += call === "s" ? "T" : "B";
      break;
    case 4:
      name += "F";
      //might need to change for far calls??
      break;
    case stage-1:
      name += stage%2 === 0 ? "W" : "M";
      break;
    case stage-2:
      name += stage%2 === 0 ? "M" : "W";
      break;
    default:
      name += callpos[p];
  }
  return name;
}

//given a row and a change, apply the change
//row could be array or string, but since the result is an array array would be better
function applypn(row, pn) {
  let next = [];
  let dir = 1;
  for (let p = 0; p < row.length; p++) {
    if (pn === "x" || !pn.includes(p+1)) {
      next.push(row[p+dir]);
      dir *= -1;
    } else if (pn.includes(p+1)) {
      next.push(row[p]);
    }
  }
  return next;
}

//pattern has the form of a row where some characters are specific bells and others are "x";
function getrowsfrompattern(pattern) {
  let rows = [];
  //holder for bells represented by x
  let v = [];
  let rounds = places.slice(0, pattern.length);
  for (let i = 0; i < rounds.length; i++) {
    if (!pattern.includes(rounds[i])) {
      v.push(bellnum(rounds[i]));
    }
  }
  if (v.length) {
    let extent = buildextent(v);
    for (let i = 0; i < extent.length; i++) {
      let row = [];
      let sub = extent[i];
      let k = 0;
      for (let j = 0; j < pattern.length; j++) {
        let c = pattern[j];
        if (c === "x") {
          row.push(sub[k]);
          k++;
        } else {
          row.push(bellnum(c));
        }
      }
      rows.push(row);
    }
  } else {
    rows.push(pattern.split("").map(bellnum));
  }
  return rows;
}

//take a pattern with parentheses and return an array of patterns with no parentheses
//no nested parentheses allowed
function handlepatterns(pattern) {
  let chars = 0;
  let openparens = [];
  let closeparens = [];
  let inside;
  let xinside;
  //collect indexes of parentheses
  for (let i = 0; i < pattern.length; i++) {
    let c = pattern[i];
    switch (c) {
      case "(":
        inside = true;
        openparens.push(i);
        break;
      case ")":
        inside = false;
        closeparens.push(i);
        break;
      default:
        if (inside && c === "x") xinside = true;
        chars++;
    }
  }
  if (openparens.length != closeparens.length || !closeparens.every((n,i) => n > openparens[i]) || chars != stage || xinside) {
    return [];
  } else {
    let current = [pattern];
    let next = [];
    for (let i = openparens.length-1; i > -1; i--) {
      for (let j = 0; j < current.length; j++) {
        let pp = expandgroup(current[j], openparens[i], closeparens[i]);
        next.push(...pp);
      }
      current = next;
      next = [];
    }
    return current;
  }
}

//take a pattern with a group in parentheses and build an extent of that group
//pattern is a string
function expandgroup(pattern, start, end) {
  let patterns = [];
  let chunk = [];
  for (let j = start+1; j < end; j++) {
    chunk.push(bellnum(pattern[j]));
  }
  let ext = buildextent(chunk);
  ext.forEach(a => {
    let p = pattern.slice(0,start) + rowstring(a) + pattern.slice(end+1);
    patterns.push(p);
  });
  return patterns;
}

//given row r, build all the permutations
function buildextent(r) {
  let n = r.length;
  let arr = [];
  if (n === 2) {
    return extenttwo(r);
  } else if (n < 13) {
    for (let i = 0; i < n; i++) {
      let others = []; //as in "not i"
      for (let j = 0; j < n; j++) {
        if (j != i) others.push(r[j]);
      }
      let ends = buildextent(others);
      ends.forEach(a => {
        a.unshift(r[i]);
        arr.push(a);
      });
    }
  }
  return arr;
}

function extenttwo(r) {
  let arr = [r, [r[1], r[0]]];
  return arr;
}
