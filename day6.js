let students = [
  { name: "John", score: 85 },
  { name: "Sarah", score: 92 },
  { name: "Mike", score: 68 },
  { name: "Anna", score: 74 }
];

// for (let i = 0; i < students.length; i++) {
//     let student = students[i];
//     console.log(`${student.name}: ${student.score}`);
// }

// function calculateAverage(students) {
//     let total = 0;
//     for (let i = 0; i < students.length; i++){
//         total += students[i].score;
//     }
//     return total / students.length;
// }

// let averageScore = calculateAverage(students);
// console.log("Average Score:", averageScore);

// function findTopStudent(students) {
//     let topStudent = students[0];
//     for (let i = 1; i < students.length; i++) {
//         if (students[i].score > topStudent.score) {
//             topStudent = students[i];
//         }   
//     }
//     return topStudent;
// }
// let topStudent = findTopStudent(students);
// console.log(" Top Student:", topStudent.name, "with score", topStudent.score);


// // .reduce() and .filter() methods
// let average = students.reduce((total, student) => 
//     total + student.score, 
// 0) / students.length;

// let aboveAverage = students.filter(student => 
//     student.score > average
// );

// console.log("Average:", average);
// console.log("Above Average:", aboveAverage);

let names = students.map(students => students.name);
console.log(names);

let studentWithStatus = students.map(student => {
    return {
        ...student,
        status: student.score >= 75 ? "Pass" : "Fail"
    };
});

console.log(studentWithStatus);

let numbers = [3, 1, 2];
numbers.sort();
console.log(numbers);

let arr = [1, 2, 3];
let copy = arr.slice();
copy.push(4);
console.log(copy); // ?
// let arr1 = [1, 2, 3];
// let arr2 = [...arr1];

// arr2.push(4);

// console.log(arr1); // ?
// console.log(arr2); // ?