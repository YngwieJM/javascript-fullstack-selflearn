function test(){
    console.log(a);
    var a = 5;
    console.log(a);
}

test(); // print udefined

function test2(){
    let a = 10;
    const b = 20;
    var c = 30;

    return { a, b, c };
}

test2();

console.log(test2().a);
console.log(test2().b);
console.log(test2().c);



function createCounter() {
  let count = 0;

  return function () {
    count++;
    return count;
  };
}

const increment = createCounter();

console.log(increment()); // 1
console.log(increment()); // 2
console.log(increment()); // 3

const numbers = [1, 2, 3, 4, 5, 6];

const evenNumbers = numbers.filter(num => num % 2 === 0);

const multiply = numbers.map(num => num * 2);

const sum = numbers.reduce((total, num) => total + num, 0);


function createBankAccount(initialBalance) {
    let balance = initialBalance;

    return {
        deposit(amount) {
            balance += amount;
        },
        withdraw(amount) {
            if (amount <= balance) {
                balance -= amount;
            } else {
                console.log("Insufficient funds");
            }
        },
        getBalance() {
            return balance;
        }

    };
    
}

const account = createBankAccount(100);

account.deposit(50);
account.withdraw(30);
console.log(account.getBalance()); // 1300