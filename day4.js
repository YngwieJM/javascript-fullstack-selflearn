function multiply(a, b) {
    return a * b;
}

console.log(multiply(5, 10)); // 50
console.log(multiply(7, 3)); // 21

function calculateTotal(price, tax){
    return price + (price * tax);
}

let total = calculateTotal(100, 0.1);
console.log(total);

function checkGrade(score){
    if(score >= 90){
        return "A";
    }else if(score >= 80){
        return "B";
    }else if(score >= 70){
        return "C";
    }else{
        return "Fail";
    }
}

console.log(checkGrade(85));

function printTable(num){
    let result = "";
    for(let i = 1; i <= 10; i++){
        console.log(`${num} x ${i} = ${num * i}`);
    }
    return result;
}

printTable(5);