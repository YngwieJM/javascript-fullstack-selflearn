let numbers = [10, 20, 30, 40, 50];

for(let i = 0; i < numbers.length; i++){
    console.log(numbers[i]);
}

console.log(numbers[0]); // 10
console.log(numbers[2]); // 30

let scores = [85, 72, 90, 66, 88];

for(let i = 0; i < scores.length; i++){
    console.log(scores[i]);
}

let totalScore = 0;
for(let i = 0; i < scores.length; i++){
    totalScore += scores[i];
}
console.log(totalScore);

let avgScore = totalScore / scores.length;
console.log(avgScore);

let highScores = scores[0];
for(let i = 1; i < scores.length; i++){
    if(scores[i] > highScores){
        highScores = scores[i];
    }
}
console.log(highScores);