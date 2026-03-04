let students = [
  { name: "Andi", score: 80 },
  { name: "Budi", score: 60 },
  { name: "Citra", score: 95 }
];

let names = students.map(student => student.name);

console.log(names);

let users = [
  { id: 1, name: "Andi", email: "andi@example.com", password: "secret" },
  { id: 2, name: "Budi", email: "budi@example.com", password: "secret" },
  { id: 3, name: "Citra", email: "citra@example.com", password: "secret" },
  { id: 4, name: "Dewi", email: "dewi@example.com", password: "secret" }
];

let safeUsers = users.map(user => ({
  id: user.id,
  name: user.name
}));

console.log(users);
console.log(safeUsers);

let passed = students.filter(student => student.score >= 75);
let mapPassed = passed.map(student => student.name);

console.log(passed);
console.log(mapPassed); 

console.log([].reduce((sum, n) => sum + n, 100));

console.log([1, 2, 3].reduce((acc, n) => {
  acc.push(n * 2);
  return acc;
}, []));

