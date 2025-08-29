const places = "1234567890ETABCD";



$(function() {
  console.log("hello");
});


// **** BELLRINGING FUNCTIONS ****

function rowstring(r) {
  return r.map(n => places[n-1]).join("");
}

function bellnum(c) {
  return places.indexOf(c)+1;
}

function buildrounds(n) {
  let rounds = [];
  for (let b = 1; b <= n; b++) {
    rounds.push(b);
  }
  return rounds;
}

function buildlargeruns(n) {
  let rows = [];
  let rounds = buildrounds(n);
  let back = buildrounds(n).reverse();
  rows.push(rowstring(rounds), rowstring(back));

  //runs of length n-1
  [rounds, back].forEach(r => {
    let next = r.slice(0,-1);
    next.unshift(r[n-1]);
    let other = r.slice(1);
    other.push(r[0]);
    rows.push(rowstring(next), rowstring(next.reverse()), rowstring(other), rowstring(other.reverse()));
  });

  //shorter runs
  for (let i = 2; i <= Math.floor(n/2); i++) {
    let rr = buildsets(n, n-i);
    rr.forEach(r => {
      if (!rows.includes(r)) rows.push(r);
    });
  }
  
  
}

//build combinations with each chunk up or down
function upanddown(r) {
  let current = [r];
  let next = [];
  //split leftovers into individual bells
  let leftovers = r[r.length-1];
  let end = rowstring(leftovers).split("");
  let num = r.length-1;
  //build combinations of the chunks forward and backward, no leftovers
  for (let i = 0; i < num; i++) {
    for (let j = 0; j < current.length; j++) {
      let c = current[j];
      let one = [];
      let two = [];
      for (let k = 0; k < num; k++) {
        if (k === i) {
          one.push(rowstring(c[k]));
          two.push(rowstring(c[k].reverse()));
        } else {
          one.push(c[k]);
          two.push(c[k]);
        }
      }
      next.push(one, two);
    }
    current = next;
    next = [];
  }
  //add the leftovers (as individual bells) back to each pattern
  for (let i = 0; i < current.length; i++) {
    current[i].push(...end);
  }
  return current;
}

//input "gs" is size of desired chunks
function buildsets(stage, gs) {
  let r = buildrounds(stage);
  //all have the chunks, then leftovers at the end
  let gg = groupings(r, gs);
  //console.log(gg.length);
  //includes leftovers as a chunk
  let numchunks = Math.ceil(stage/gs);
  let sets = [];
  
  gg.forEach(g => {
    let current = upanddown(g);
    sets.push(...current);
  });
  //next an extent with each of the sets, THEN join
  let rows = [];
  sets.forEach(s => {
    let a = buildextent(s);
    a.forEach(o => {
      let str = o.join("");
      if (!rows.includes(str)) {
        rows.push(str);
      }
    });
  });
  //console.log(rows.length);
  return rows;
}

//break a row into chunks of n consecutive bells, and a chunk of leftovers
//r is a row segment, size of desired chunks
function groupings(r, size) {
  let arr = [];
  let howmany = Math.floor(r.length/size);
  let left = r.length%size;
  let dice = [];
  for (let i = 0; i <= left; i++) {
    let d = [];
    for (let j = 0; j < size; j++) {
      d.push(j+i);
    }
    dice.push(d);
  }
  
  if (howmany === 1) {
    dice.forEach(d => {
      let chunk = [];
      let leftover = [];
      for (let j = 0; j < r.length; j++) {
        if (d.includes(j)) {
          chunk.push(r[j]);
        } else {
          leftover.push(r[j]);
        }
      }
      arr.push([chunk, leftover]);
    });
    return arr;
  } else {
    dice.forEach(d => {
      let start = [];
      let chunk = [];
      let leftover = [];
      for (let j = 0; j < r.length; j++) {
        if (j < d[0]) {
          start.push(r[j]);
        } else if (d.includes(j)) {
          chunk.push(r[j]);
        } else {
          leftover.push(r[j]);
        }
      }
      let rest = groupings(leftover, size);
      rest.forEach(a => {
        a[a.length-1].unshift(...start);
        a.unshift(chunk);
        arr.push(a);
      });
    });
  }
  return arr;
}

function buildextent(r) {
  let n = r.length;
  let arr = [];
  if (n === 2) {
    return extenttwo(r);
  } else if (n < 13) {
    for (let i = 0; i < n; i++) {
      let others = [];
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
  let arr = [r,[r[1],r[0]]];
  return arr;
}
