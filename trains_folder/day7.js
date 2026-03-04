let student = {
  name: "Andi",
  age: 20,
  score: 85
};

console.log(student.name);   // "Andi"
console.log(student.age);    // 20

console.log(student["score"]); // 85

let key = "name";
console.log(student[key]); // "Andi"

student.score = 90;
student.city = "Jakarta";

let obj1 = {name: "Andi"};
let obj2 = obj1;

obj2.name = "Budi";

console.log(obj1.name);

let user = {
    name: "Andi",
    address: {
        city: "Jakarta",
        zip: 12345
    },
    work: {
        company: "Tech Co",
        position: "Developer"
    }
};

console.log(Object.keys(user)); // ["name", "address"]
console.log(Object.values(user)); // ["Andi", { city: "Jakarta", zip: 12345 }]
console.log(Object.entries(user)); // [["name", "Andi"], ["address", { city: "Jakarta", zip: 12345 }]]

let a = {x: 10};
let b = {...a};
b.x = 20;

console.log(a.x);