// console.log(5 > 3);  // Greater than
// console.log(5 < 3);  // Less than
// console.log(5 == "5"); // Equality
// console.log(5 === "5"); // Strict Equality

// // if-else statement
// let age = 18;
// if (age >= 18){
//     console.log("You are an adult.");
// }else{
//     console.log("You are a minor.");
// }

// // Multiple conditions
// let score = 85;

// if(score >= 90){
//     console.log("Grade A");
// }else if(score >= 80){
//     console.log("Grade B");
// }else{
//     console.log("Grade C");
// }

// //Logical operators
// let ages = 20;
// let hasID = true;

// if(ages >= 17 && hasID){
//     console.log("You can enter the club.");
// }

let score = 85;
let attendance = 80;

if (attendance < 80) {
  console.log("Failed due to low attendance");
} else {
  let grade;

  if (score >= 90) {
    grade = "A";
  } else if (score >= 80) {
    grade = "B";
  } else if (score >= 70) {
    grade = "C";
  } else {
    grade = "Fail";
  }

  console.log(`Student score: ${score}`);
  console.log(`Grade: ${grade}`);
}