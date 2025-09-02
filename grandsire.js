const places = "1234567890ET";
//complib api url for getting methods
//do I actually need this??
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
//clicked leadheads in source material
var lhstoadd = [];
//leadhead in workspace that has been clicked on
var activelh;
//leadheads that can come directly after activelh
var nextavailable;
//results from row search field
var searchresults = {};

//table cell being hovered over that could receive the current activelh
//hmmm could I just highlight these for touchscreens
var gridtarget;
// plain, bob, or single, if activelh goes into gridtarget
var connection;


$(function() {
  
});





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

//build Grandsire course order
//does not include tenor
function homecourseorder(stage) {
  let home = [2,3,4];
  for (let b = 5; b < stage; b+=2) {
    home.unshift(b);
    if (b < stage-1) home.push(b+1);
    return home;
  }
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


//build plain course
function buildgrandsire(stage) {
  let pn = [[3],[1]];
  for (let i = 0; i < stage-1; i++) {
    pn.push([stage],[1]);
  }
  if (stage%2===0) {
    for (let i = 0; i < pn.length; i++) {
      if ([3,1].includes(pn[i][0])) {
        pn[i].push(stage);
      } else {
        pn.splice(i,1, "x");
      }
    }
  }
  let prev = places.slice(0,stage).split("").map(bellnum);
  for (let i = 0; i < stage-2; i++) {
    for (let j = 0; j < pn.length; j++) {
      let change = pn[j];
      let row = applypn(prev, change);
      rowarr.push(row);
      prev = row;
    }
  }
}

let transpositions = [
  {
    stage: 11,
    plain: [1,2,5,3,7,4,9,6,11,8,10],
    bob: [1,7,5,2,9,3,11,4,10,6,8],
    single: [1,5,7,2,9,3,11,4,10,6,8]
  },
  {
    stage: 9,
    plain: [1,2,5,3,7,4,9,6,8],
    bob: [1,7,5,2,9,3,8,4,6],
    single: [1,5,7,2,9,3,8,4,6]
  },
  {
    stage: 7,
    plain: [1,2,5,3,7,4,6],
    bob: [1,7,5,2,6,3,4],
    single: [1,5,7,2,6,3,4]
  }
];
//given a leadhead, build the options for the next leadhead
function nextleads(lh) {
  let next = {};
  let tt = transpositions.find(o => o.stage === stage);
  ["plain","bob","single"].forEach(w => {
    let row = transpose(lh, tt[w]);
    next[w] = row;
  });
  return next;
}

//I'm going to attempt to make this work for both leadheads and course orders???
function transpose(row, t) {
  let next = [];
  for (let i = 0; i < t.length; i++) {
    let p = t[i];
    next.push(row[p-1]);
  }
  return next;
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


