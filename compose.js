var url = "https://api.complib.org/";
var rowarr = [];
var arr2 = [];
var stage;
var numbells;
var tenor;
var methodinfo = {};
var compinfo = {};
var courseorders;
var places = "1234567890ET";
var selectedlh;
var activelh;
var nextavailable;
var calltype = "near";
var gridtarget;


$(function() {
  $("#submit").on("click", subcomplib);
  $("#courseorders").on("click", "li", courseorderclick);
  $("#leadheads").on("click", "li", leadheadclick);
  $("#addtoworkspace").on("click", addtoworkspace);
  $("#chosenleads").on("click", "li", worklhclick);
  $("#workspacegrid").on("mouseenter", "td", worktablehover);
  $("#workspacegrid").on("mouseleave", "td", worktableleave);
  $("#workspacegrid").on("click", "td", worktableclick);
  $("#workspacegrid").on("click", ".removelh", removelhclick);
});


function subcomplib() {
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

function getcomplib(compid) {
  var xhr = new XMLHttpRequest();
  
  xhr.open('GET', url+"method/"+compid+"/rows", true);
  xhr.send();
  
  xhr.onload = function() {
    let results = JSON.parse(xhr.responseText);
    rowarr = [];
    
    if (results.rows) {
      stage = results.stage;
      let plainlhs = plainleadheads(stage).map(a => rowstring(a));
      let regular;
      
      for (let i = 2; i < results.rows.length; i++) {
        let row = results.rows[i][0].split("").map(bellnum);
        rowarr.push(row);
        if (!methodinfo.leadlength && results.rows[i][2] === "16") {
          methodinfo.leadlength = i-1;
          regular = plainlhs.includes(results.rows[i][0]);
          methodinfo.leadhead = rowstring(row);
          methodinfo.leadend = results.rows[i-1][0];
          leadorder(row);
          //;
          //console.log(nextleads(row));
        }
        
      }
      if (![6,8].includes(stage) || !regular) {
        $("#courseorders").append(`<p>Can't work with ${results.title} yet</p>`);
      } else {
        $("h2").text(results.title);
        $.get("courseorder"+stage+".json", function(body) {
          courseorders = body;
          console.log(courseorders.length);
          console.log(courseorders[0]);
          methodinfo.fcourses = findfalse();
          //console.log(methodinfo.fcourses);
          setuptools();
        });
      }
    }
  }
}

function setuptools() {
  let cos = stage === 6 ? courseorders : courseorders.filter(o => o.incourse === true && o.tentogether === true);
  console.log(cos[0]);
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
  for (let r = 1; r <= 8; r++) {
    let trow = `<tr>`;
    for (let c = 1; c <= 2; c++) {
      let cl = c === 1 ? ` class="column1"` : "";
      trow += `<td id="r${r}c${c}"${cl}></td>`;
    }
    trow += `</tr>`;
    $("#workspacegrid").append(trow);
  }
  $("#workinglist").append(`<button id="addrows">+</button>`);
}

function tablerelease(e) {
  console.log(e.currentTarget.id);
}

function worktableclick(e) {
  if (gridtarget === e.currentTarget.id) {
    let id = gridtarget.slice(0,-1) + "2";
    $("#"+id).text("x");
    $("#"+id).addClass("removelh");
    $(e.currentTarget).text(activelh);
    $(e.currentTarget).css("background-color", "white");
  }
}

function removelhclick(e) {
  $(e.currentTarget).text("");
  $(e.currentTarget).removeClass("removelh");
  let id = e.currentTarget.id.slice(0,-1) + "1";
  $("#"+id).text("");
}

function worktablehover(e) {
  if (activelh && $(e.currentTarget).text().length === 0) {
    let trow = Number(e.currentTarget.id.slice(1,-2));
    let before;
    let after;
    if (trow === 1) {
      before = true;
    } else {
      let prev = ["#","r",trow-1,"c1"].join("");
      if ($(prev).text().length === 0) {
        before = true;
      } else {
        let blh = $(prev).text().split("").map(bellnum);
        let next = nextleads(blh);
        console.log(next);
        if (Object.keys(next).find(key => rowstring(next[key]) === activelh)) {
          before = true;
        }
      }
    }
    let below = ["#r",trow+1,"c1"].join("");
    if (!$(below) || $(below).text().length === 0 || nextavailable.includes($(below).text())) {
      after = true;
    }
    if (before && after) {
      gridtarget = e.currentTarget.id;
      $(e.currentTarget).css({cursor: "pointer", "background-color": "lightblue"});
    } else {
      gridtarget = null;
    }
    
  }
}
function worktableleave(e) {
  gridtarget = null;
  $(e.currentTarget).css("background-color", "white");
}

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

function comparecourse(course) {
  let dex = {};
  for (let i = 0; i < rowarr.length; i++) {
    let str = rowstring(rowarr[i]);
    dex[str] = i+1;
  }
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

function findfalse() {
  //for each course order
  //build the course
  //comparecourse(course)
  let cos = stage === 6 ? courseorders : courseorders.filter(o => o.incourse === true && o.tentogether === true);
  cos.shift();
  let leadlength = methodinfo.leadlength;
  //console.log("number of course orders to check: "+cos.length);
  let fcourses = [];
  for (let i = 0; i < cos.length; i++) {
    let co = cos[i].co;
    let course = buildcourse(co);
    if (i === 0) {
      //console.log(course);
    }
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
    }
  }
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
function getcofromlh(lh) {
  let home = homecourseorder(lh.length);
  home.unshift(lh.length);
  let co = [];
  for (let i = 0; i < home.length; i++) {
    co.push(lh[home[i]-1]);
  }
  let i = co.indexOf(lh.length);
  let rot = co.slice(i+1);
  if (i > 0) {
    rot.push(...co.slice(0,i));
  }
  return rot;
}


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

function courseorderclick(e) {
  selectedlh = null;
  $("#addtoworkspace").addClass("disabled");
  $("#courseorders li.selected").removeClass("selected");
  $("#leadheads li.selected").removeClass("selected");
  $(e.currentTarget).addClass("selected");
  $("#leadheads").contents().detach();
  let costr = $(e.currentTarget).text();
  let co = costr.split("").map(bellnum);
  let homestr = rowstring(homecourseorder(stage));
  let leads = [];
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

function leadheadclick(e) {
  if (!$(e.currentTarget).hasClass("inuse")) {
    $("#addtoworkspace").removeClass("disabled");
  }
  $("#leadheads li.selected").removeClass("selected");
  $(e.currentTarget).addClass("selected");
  selectedlh = $(e.currentTarget).text();
}

function addtoworkspace(e) {
  if (!$(e.currentTarget).hasClass("disabled")) {
    $(e.currentTarget).addClass("disabled");
    let lh = selectedlh.split("").map(bellnum);
    let co = getcofromlh(lh);
    let costr = rowstring(co);
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
    $("#chosenleads ul").append(`<li id="al${selectedlh}">${costr}: ${selectedlh}</li>`);
    let num = $("#chosenleads li").length * methodinfo.leadlength;
    $("#numberadded").text(`${num} rows`);
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
  }
  
}

//lh as array
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

function worklhclick(e) {
  $("#chosenleads li.selected").removeClass("selected");
  $("li.close").removeClass("close");
  $(e.currentTarget).addClass("selected");
  activelh = e.currentTarget.id.slice(2);
  let next = nextleads(activelh.split("").map(bellnum));
  nextavailable = [];
  ["plain", "b14"].forEach(key => {
    nextavailable.push(rowstring(next[key]));
  });
  if (stage === 6) {
    let key = calltype === "near" ? "s1234" : "s1456";
    nextavailable.push(rowstring(next[key]));
  }
  nextavailable.forEach(r => {
    if ($("#al"+r).length) {
      $("#al"+r).addClass("close");
    } else {
      let co = getcofromlh(r.split("").map(bellnum));
      //console.log(co);
      let costr = rowstring(co);
      $("li#c"+costr).addClass("close");
    }
  });
}
