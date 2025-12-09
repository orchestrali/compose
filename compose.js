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

//store info: leadlength, leadhead, leadend, pborder, fcourses, title
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
//keys are coursing order strings, values are objects with leadhead strings as keys, arrays of rowstrings as values
var searchresults = {};
//so I can see them
var extraresults = {};

var calltype = "near";
//table cell being hovered over that could receive the current activelh
//hmmm could I just highlight these for touchscreens
var gridtarget;
// plain, bob, or single, if activelh goes into gridtarget
var connection;
var connectbelow;
//if a pattern is searched for and resulting leadheads are added to workspace, save those
var searchadded = [];
//holder for composition leadhead list
var complist;
//notes: not sure I'm actually dealing with falseness in the composition
//option to export something as text????
//put course orders/leadheads in multiple spans so they can highlight multiple colors???
//add some determination of composition coming round
//add a method info panel at the top!

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
  //this still isn't everything
  $("#courseorders,#leadheads,#leadinfo,#chosenleads ul,#composition,#compsummary").contents().detach();
  $("#addrows").remove();
  $("h2,#numberadded,#workspacegrid td").text("");
  $(".removelh").removeClass("removelh");
  ["hasrow","close","false"].forEach(w => $("."+w).removeClass(w)); //uhhhh shouldn't need this? they should all be gone???
  lhstoadd = [];
  methodinfo = {};
  compinfo = {};
  courseorders = [];
  //set calltype here?
  calltype = $("#farcalls").is(":checked") ? "far" : "near";
  let num = $("#complibid").val();
  if (num.length > 4 && /^\d+$/.test(num)) {
    let access = $("#accesskey").val() || "";
    getcomplib(num, access);
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
function getcomplib(mid, access) {
  var xhr = new XMLHttpRequest();
  let q = access.length ? "?accessKey="+access : "";
  xhr.open('GET', url+"method/"+mid+"/rows"+q, true);
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
      if (![6,7,8,9,10,11,12].includes(stage) || !regular) {
        $("#courseorders").append(`<p>Can't work with ${results.title} yet</p>`);
      } else {
        $("h2").text(results.title);
        methodinfo.title = results.title;
        let n = stage >= 8 ? 8 : stage;
        $.get("courseorder"+n+".json", function(body) {
          courseorders = body;
          if (stage > 8) expandcourseorders(stage);
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
  compinfo.falseleads = {};
  compinfo.courses[rowstring(cos[0].co)] = ["inuse"];
  compinfo.leads[places.slice(0,stage)] = ["inuse"];
  let fleads = getfalsefromlead(places.slice(0,stage).split("").map(bellnum));
  fleads.forEach(o => {
    compinfo.courses[rowstring(o.co)] = ["false"];
    compinfo.leads[o.lh] = ["false"];
    compinfo.falseleads[o.lh] = [places.slice(0,stage)];
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
      //let text = connection[0] === "b" ? "-" : "s";
      $("#"+cid).text(connection);
    }
    if (connectbelow != "plain") {
      let rownum = Number(id.slice(1,-2))+1;
      let cid = "#r"+rownum+"c0";
      $(cid).text(connectbelow);
    }
    //mark lh as used in the workspace list
    if (places.includes(activelh)) {
      //need to count these to check when it comes round
    } else {
      $("#al"+activelh).addClass("false");
    }
    displayfullcomp();
  }
}

function getworktablecontents() {
  let contents = [];
  let current = [];
  $("#workspacegrid tr").each((i) => {
    let id = ["#r",i+1,"c1"].join("");
    let lh = $(id).text();
    //console.log(i, lh);
    if (lh.length) {
      let cid = id.slice(0,-1) + "0";
      let call = $(cid).text();
      current.push({lh: lh, call: call});
    } else {
      if (current.length) contents.push(current);
      current = [];
    }
  });
  if (current.length) contents.push(current);
  return contents;
}

//remove a lh from worktable
function removelhclick(e) {
  let id = e.currentTarget.id.slice(0,-1)+"1";
  let aid = $("#"+id).text();
  $("#al"+aid).removeClass("false");
  $(e.currentTarget).removeClass("removelh");
  $(e.currentTarget).parent().children().text("");
  displayfullcomp();
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
        //console.log(next);
        connection = Object.keys(next).find(key => rowstring(next[key]) === activelh);
        if (connection) {
          if (connection != "plain") {
            let call = getcallname(activelh.split("").map(bellnum), connection[0]);
            connection = call;
          }
          before = true;
        }
      }
    }
    let below = ["#r",trow+1,"c1"].join("");
    let empty = !$(below) || $(below).text().length === 0;
    if (empty) {
      after = true;
      connectbelow = "plain";
    } else if (nextavailable.includes($(below).text())) {
      after = true;
      connectbelow = "plain";
      //need to figure out call below!
      let i = nextavailable.indexOf($(below).text());
      if (i > 0) {
        let c = i === 1 ? "b" : "s";
        connectbelow = getcallname(nextavailable[i].split("").map(bellnum), c);
      }
    }
    //if the composition would work, shade the table cell
    if (before && after) {
      gridtarget = e.currentTarget.id;
      $(e.currentTarget).css({cursor: "pointer", "background-color": "lightblue"});
    } else {
      gridtarget = null;
      connection = null;
      connectbelow = null;
    }
    
  }
}
function worktableleave(e) {
  gridtarget = null;
  connection = null;
  connectbelow = null;
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
  //if the leadhead is part of the search results, display the rows in the lead that match
  if ($(e.currentTarget).hasClass("hasrow") && lhstoadd.length < 2) {
    let rows = searchresults[selectedco][lh];
    displaysearch(rows);
  }

  //if the leadhead is false against something in the workspace, display what
  if ($(e.currentTarget).hasClass("false") && lhstoadd.length < 2) {
    displayfalse(lh);
  }
  
}

//add items in lhstoadd (from source material) to workspace
function addtoworkspace(e) {
  if (!$(e.currentTarget).hasClass("disabled")) {
    $(e.currentTarget).addClass("disabled");
    lhstoadd.forEach(selectedlh => {
      if (searchresults[selectedco] && searchresults[selectedco][selectedlh]) {
        //save the lh and rows - or just rows???
        searchadded.push(...searchresults[selectedco][selectedlh]);
      }
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
      let c = $("#l"+selectedlh).hasClass("close") ? ` class="close"` : "";
      $("#chosenleads ul").append(`<li id="al${selectedlh}"${c}>${costr}: ${selectedlh}</li>`);
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
        if (!compinfo.falseleads[o.lh]) {
          compinfo.falseleads[o.lh] = [selectedlh];
        } else if (!compinfo.falseleads[o.lh].includes(selectedlh)) {
          compinfo.falseleads[o.lh].push(selectedlh);
        }
  
      });
    //console.log(compinfo.leads);
    });
  }
  
}

//click on a leadhead in the workspace (not in table)
function worklhclick(e) {
  clearsearch();
  if (lhstoadd.length > 1) {
    $("#leadheads li.selected").removeClass("selected");
    lhstoadd = [];
  }
  $("#chosenleads li.selected").removeClass("selected");
  $("li.close").removeClass("close");
  $(e.currentTarget).addClass("selected");
  activelh = e.currentTarget.id.slice(2);
  //figure out leadheads that can come next
  let next = nextleads(activelh.split("").map(bellnum));
  nextavailable = [];
  
  ["plain", "bob"].forEach(key => {
    nextavailable.push(rowstring(next[key]));
  });
  //singles only allowed on minor and triples (currently)
  if ([6,7].includes(stage)) {
    //let key = (calltype === "near" || stage === 7) ? "s1234" : "s1456";
    nextavailable.push(rowstring(next.single));
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
  connectbelow = null;
  
  ["selected", "close"].forEach(c => {
    $("#chosenleads li."+c).removeClass(c);
  });
  $("#sourcematerial li.close").removeClass("close");
}

function clearsearch() {
  searchresults = {};
  extraresults = {};
  $("li.hasrow").removeClass("hasrow");
  $("#leadinfo").children().remove();
}

//idea: allow searching for a string shorter than the stage? flexible location in row
function handlesearchbar(e) {
  clearworkselection();
  clearsearch();
  $("#searchbar p").remove();
  let text = $("#search").val().toUpperCase();
  let problem;
  let patterns = [text];

  if (/^X+$/.test(text)) {
    problem = "all rows match!";
  } else if (/[^\dXET\(\)]/.test(text)) {
    problem = "invalid character in search";
  } else if (text.split("").some(c => places.indexOf(c) >= stage)) {
    problem = "search doesn't match stage";
  } else if (text.includes("(") || text.includes(")")) {
    patterns = handlepatterns(text);
    if (patterns.length === 0) problem = "problem with parentheses";
  }
  if (!problem && patterns[0].length < stage) {
    
    //console.log(patternstage(text));
    let arr = [];
    patterns.forEach(p => {
      let res = patternstage(p);
      arr.push(...res);
    });
    patterns = arr;
    //problem = "search doesn't match stage";
  } 
  
  if (problem) {
    $("#searchbar").append(`<p>${problem}</p>`);
  } else {
    let cocount = 0;
    let rowcount = 0;
    let searched = 0;
    let availrows = [];
    let res = {};
    patterns.forEach(p => {
      let rows = getrowsfrompattern(p);
      //need to get lhs and cos from each row
      rows.forEach(r => {
        searched++;
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
    let totalco = 0;
    for (let co in res) {
      totalco++;
      let found = $("#c"+co).length;
      if (found) {
        searchresults[co] = res[co];
        cocount++;
        for (let lh in res[co]) {
          rowcount += res[co][lh].length;
          res[co][lh].forEach(r => {
            if (!availrows.includes(r)) {
              availrows.push(r);
            }
          });
          if ($("#al"+lh).length) {
            $("#al"+lh).addClass("hasrow");
          }
          if ($("#l"+lh).length) $("#l"+lh).addClass("hasrow");
          $("li#c"+co).addClass("hasrow");
          if (lhstoadd.length === 1 && lhstoadd.includes(lh)) {
            displaysearch(res[co][lh]);
          }
        }
      } else {
        extraresults[co] = res[co];
      }
    }
    if (cocount === 0) {
      $("#searchbar").append(`<p>row not available</p>`);
    } else {
      let w = rowcount === 1 ? " row" : " rows";
      $("#searchbar").append(`<p>${rowcount+w} available (${availrows.length} unique)</p>`);
    }
    console.log(searched + " rows searched for");
    console.log("rows available: "+rowcount);
    console.log("additional coursing orders: "+(totalco-cocount));
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

//given the selected leadhead which is false against something in the workspace
//in the source material info section, display the leadhead(s) that conflict
//lh needs to be a string
function displayfalse(lh) {
  let flh = compinfo.falseleads[lh];
  let html = `<p>Active leads that share a row or rows with this lead:</p>
  <ul>
  `;
  flh.forEach(r => {
    html += `<li>${r}</li>
    `;
  });
  html += `</ul>`;
  $("#leadinfo").append(html);
}

//draw the actual rows
//should do summary of the composition here too
function displayfullcomp() {
  complist = getworktablecontents();
  $("#composition").contents().remove();
  let totalrows = 0;
  $("#composition").append(`<h4></h4>`);
  let compsegments = [];
  complist.forEach(a => {
    let compsummary = a.map(o => o.call).join("").replace(/\-/g, "");
    compsegments.push(compsummary);
    $("#composition").append(`<div class="grid"></div>`);
    totalrows += a.length*methodinfo.leadlength;
    let length = a.length*methodinfo.leadlength*20 + 50;
    let parent = svg.svg($("div.grid:last-child"), null, null, 400, length, {xmlns: "http://www.w3.org/2000/svg", "xmlns:xlink": "http://www.w3.org/1999/xlink"});
    let rows = [];
    for (let i = 0; i < a.length; i++) {
      let o = a[i];
      let first = {row: o.lh.split(""), lh: true};
      if (o.call.length) first.call = o.call;
      rows.push(first);
      if (i > 0 && i === a.length-1 && places.includes(o.lh)) {
        //this is the last leadhead and it's rounds
        //actually don't do anything more
        totalrows -= methodinfo.leadlength;
      } else {
        let lead = buildlead(o.lh);
        rows.push(...lead);
      }
      
    }
    displaycomprows(parent, rows);
  });
  let html = "";
  if (compsegments.length === 1) {
    html = `<p>Composition:</p>
    <p>${compsegments[0]}</p>`;
  } else {
    compsegments.forEach((s,i) => {
      html += `<p>Segment ${i}: ${s}</p>`;
    });
  }
  $("#compsummary").html(html);
  $("#composition h4").text(totalrows + " " + methodinfo.title);
}

function displaycomprows(parent, rows) {
  let lineg = svg.group(parent, {style: "stroke: #111111; stroke-width: 1px; fill: none;"});
  svg.line(lineg, 38, 20, 38+rows[0].row.length*16, 20);
  let rectg = svg.group(parent, {style: "stroke: none; fill: lavender;"});
  let goodg = svg.group(parent, {style: "stroke: none; fill: lightgreen;"});
  let treblepp = [];
  let tenorpp = [];
  //add text and lines above leadheads
  let textg = svg.group(parent, {style: "font-family: Verdana, sans-serif; fill: #000000; font-size: 16px;"});
  rows.forEach((o,i) => {
    let y = 16+i*20;
    if (o.call) {
      svg.text(textg, 10, y, o.call);
    }
    let evaluation = places.includes(o.row.join("")) ? [] : evaluaterow(o.row);
    let purple;
    if (searchadded.includes(o.row.join(""))) {
      purple = true;
      svg.rect(rectg, 38, y-16, o.row.length*16, 20);
    }
    let words = [];
    evaluation.forEach(ch => {
      if (!purple) svg.rect(goodg, 38+ch.start*16, y-16, ch.size*16, 20);
      words.push(ch.what);
    });
    if (words.length) {
      svg.text(textg, 80+o.row.length*16, y, words.join("; "));
    }
    
    for (let j = 0; j < o.row.length; j++) {
      svg.text(textg, 40+j*16, y, o.row[j]);
      if (o.row[j] === "1") treblepp.push(j);
      if (o.row[j] === places[stage-1]) tenorpp.push(j);
    }
    if (i > 0 && o.lh) {
      svg.line(lineg, 38, y-16, 38+o.row.length*16, y-16);
    }
  });
  
  //draw treble path
  let trebleg = svg.group(parent, {style: "stroke: red; stroke-width: 1px; fill: none;"});
  svg.path(trebleg, buildsvgpath(treblepp));
  //draw tenor path
  let tenorg = svg.group(parent, {style: "stroke: blue; stroke-width: 2px; fill: none;"});
  svg.path(tenorg, buildsvgpath(tenorpp));
}

//pp is array of place numbers
function buildsvgpath(pp) {
  let current = pp[0];
  let path = ["M", 45+16*current, "10"].join(" ");
  for (let i = 1; i < pp.length; i++) {
    let p = pp[i];
    if (p === current) {
      path += " v 20";
    } else if (p > current) {
      path += " l 16 20";
    } else if (p < current) {
      path += " l -16 20";
    }
    current = p;
  }
  return path;
}

//row is array of strings
function evaluaterow(row) {
  let res = [];
  let nums = row.map(s => places.indexOf(s)+1);
  let tenorhome = nums[row.length-1] === row.length;
  let diffs = [];
  let absdd = [];
  let pairs = [];
  let between = [];
  let odddd = [];
  let evendd = [];
  for (let i = 1; i < row.length; i++) {
    let d = nums[i]-nums[i-1];
    diffs.push(d);
    absdd.push(Math.abs(d));
    i%2 === 1 ? pairs.push(d) : between.push(d);
    if (i%2 === 0) {
      odddd.push(nums[i]-nums[i-2]);
    } else if (i > 1) {
      evendd.push(nums[i]-nums[i-2]);
    }
  }
  let nonsteps = [];
  let nonskips = [];
  for (let i = 0; i < absdd.length; i++) {
    if (absdd[i] != 1) nonsteps.push(i);
    if (absdd[i] != 2) nonskips.push(i);
  }
  let absstr = rowstring(absdd);
  
  let chunk = {};
  
  if (nonsteps.length === 0 && diffs[0] === -1) {
    chunk = {
      start: 0,
      size: row.length,
      what: "Backrounds"
    };
  }
  
  if (nonskips.length === 1 && tenorhome) {
    chunk.start = 0;
    chunk.size = row.length;
    chunk.what = row[0] === "1" ? "Queens" : "Kings";
  }
  
  if (evendd.every(n => n === 1) && tenorhome && odddd.every(n => [1,-1].includes(n))) {
    chunk.start = 0;
    chunk.size = row.length;
    chunk.what = odddd[0] === 1 ? "Tittums" : "Exploded Tittums";
  }
  
  if (nonsteps.length === 1) {
    chunk.start = 0;
    chunk.size = row.length;
    if ([0,row.length-2].includes(nonsteps[0])) {
      chunk.what = (row.length-1)+"-bell run";
    } else if ([1,row.length-3].includes(nonsteps[0]) && diffs[0] != diffs[diffs.length-1]) {
      chunk.what = "near miss"; //of rounds or backrounds
    } else {
      chunk.what = "two runs"; //includes waterfall & reverse, see-saw and variants
    }
  }
  
  if (nonsteps.length === 2 && absstr.includes("212")) {
    let filter = diffs.filter(n => n === 1);
    //the 1 between the 2s needs to be the opposite direction of the other 1s
    if (filter.length < diffs.length-2) {
      chunk.start = 0;
      chunk.size = row.length;
      chunk.what = "near miss";
    }
  }
  if (nonsteps.length === 2 && nonsteps.includes(0) && nonsteps.includes(diffs.length-1)) {
    chunk.start = 0;
    chunk.size = row.length;
    chunk.what = (row.length-2)+"-bell run";
  }
  
  if (chunk.what) {
    res.push(chunk);
  } else {
    if (absstr.startsWith("111")) {
      chunk.start = 0;
      chunk.size = nonsteps[0]+1;
      chunk.what = chunk.size+"-bell run";
      res.push(chunk);
    }
    if (absstr.endsWith("111")) {
      let end = {
        start: nonsteps[nonsteps.length-1]+1,
        size: diffs.length-nonsteps[nonsteps.length-1],
      };
      end.what = end.size+"-bell run";
      res.push(end);
    }
    
    if (tenorhome && nonskips[nonskips.length-1] < diffs.length-2) {
      let last = nonskips[nonskips.length-1];
      let prev = nonskips[nonskips.length-2];
      if (last-prev === diffs.length-last) {
        let end = {
          size: (last-prev)*2,
          what: "Queensy"
        };
        end.start = row.length-end.size;
        res.push(end);
      }
    }
    
    if (tenorhome && absstr.endsWith("322")) {
      let end = {
        start: row.length-4,
        size: 4,
        what: "arpeggio"
      };
      res.push(end);
    }
    
  }
  return res;
}





// **** BELLRINGING FUNCTIONS ****

//convert bell characters to numbers
function bellnum(n) {
  return places.indexOf(n)+1;
}

//convert array of bell numbers to string of characters
function rowstring(arr) {
  let r = arr.map(n => places[n-1]);
  return r.join("");
}

//build plain bob course order
//does not include tenor
function homecourseorder(stage) {
  let home = [];
  for (let b = 2; b < stage; b+=2) {
    home.push(b);
    if (b < stage-1) home.unshift(b+1);
  }
  return home;
}

//adjust major coursing orders for more bells
function expandcourseorders(n) {
  for (let b = 8; b < n; b+=2) {
    courseorders.forEach(o => {
      o.co.push(b);
      if (b < stage-1) o.co.unshift(b+1);
    });
  }
}

//...actually lh could be string
//does not do the last row of the lead
function buildlead(lh) {
  let rows = [];
  for (let i = 0; i < methodinfo.leadlength-1; i++) {
    let old = rowarr[i];
    let o = {};
    let row = [];
    //for each place, find bell in plain course, use that as index
    for (let p = 0; p < stage; p++) {
      let j = old[p]-1;
      row.push(lh[j]);
    }
    o.row = row;
    rows.push(o);
  }
  return rows;
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
        if (o && o.incourse && o.tentogether) {
          cc.push(a);
        } else {
          otherc.push({co: s, count: 1});
        }
      } else if (!o || !o.incourse || !o.tentogether) {
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
  for (let i = -1; i < methodinfo.leadlength-1; i++) {
    let row = i === -1 ? places.slice(0,stage).split("").map(bellnum) : rowarr[i];
    if (row.indexOf(1) === trebleplace) {
      let lh = [1];
      for (let b = 2; b <= stage; b++) {
        let p = row.indexOf(b);
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
//inputs do not include the tenor!!
function getfalse2(fco, co) {
  let eq = [];
  let home = homecourseorder(co.length+2);
  for (let i = 0; i < co.length; i++) {
    let b = fco[i];
    let j = home.indexOf(b);
    eq.push(co[j]);
  }
  return eq;
}

//lh must be THE leadhead as an array of numbers
//only for monocyclic methods with treble as hunt bell
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
  //console.log(leadco);
  
  let results = [];
  let tenorplace = lh.indexOf(stage);
  
  for (let i = 0; i < methodinfo.fcourses.length; i++) {
    let o = methodinfo.fcourses[i];
    let co = getfalse2(o.co, leadco);
    //console.log(co);
    
    let coleads = getlhsfromco(co);
    //console.log(coleads);
    
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
  if (calltype === "far" && stage%2 === 1) {
    //calls apply earlier
    mle = rowarr[methodinfo.leadlength-3];
  }
  let plainh = [];
  let end = [];
  for (let i = 0; i < lh.length; i++) {
    let bh = mlh[i];
    let be = mle[i];
    plainh.push(lh[bh-1]);
    end.push(lh[be-1]);
  }
  next.plain = plainh;
  let calls = buildcallpns(stage, calltype);
  for (let key in calls) {
    let row = applypn(end, calls[key]);
    next[key] = stage%2 === 0 || calltype === "near" ? row : applypn(row, [1]);
  }
  return next;
}

//building far calls but not using them yet
//calltype adjustments...
function buildcallpns(n, ct) {
  let calls = {
    bob: [1,4],
    single: [1,2,3,4]
  };
  if (n%2 === 1) {
    for (let key in calls) {
      calls[key].push(n);
    }
  }
  //harder on odd stages...
  let farcalls = {};
  let farb = [1, n-2];
  let fars = [1, n-2, n-1, n];
  if (n%2 === 1) {
    farb.shift();
    fars.shift();
  }
  farcalls.bob = farb;
  farcalls.single = fars;
  return ct === "far" ? farcalls : calls;
}

var callpos = {5: "V", 6: "X", 7: "S", 8: "E", 9: "N"};
//lh will need to be array of numbers
function getcallname(lh, call) {
  //tenor place
  let p = lh.indexOf(stage)+1;
  let single = call === "s";
  let name = single ? "s" : "-";
  switch (p) {
    case stage:
      name += "H";
      break;
    case 2:
      
      name += calltype === "far" ? "I" : single ? "B" : "I";
      break;
    case 3:
      
      name += calltype === "far" ? "B" : single ? "T" : "B";
      break;
    case 4:
      name += "F";
      //might need to change for far calls?? no don't think so??
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

//pattern has the form of a row where some characters are specific bells and others are "X";
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
        if (c === "X") {
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

function patternstage(pattern) {
  let n = pattern.length;
  let res = [];
  for (let i = 0; i <= stage-n; i++) {
    let p = "";
    for (let j = 0; j < stage; j++) {
      if (j < i || j >= i+n) {
        p += "X";
      } else if (j === i) {
        p += pattern;
      }
    }
    res.push(p);
  }
  return res;
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
        if (inside && c === "X") xinside = true;
        chars++;
    }
  }
  if (openparens.length != closeparens.length || !closeparens.every((n,i) => n > openparens[i]) || chars > stage || xinside) {
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
