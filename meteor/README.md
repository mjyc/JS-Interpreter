## Usage

* run `ln -s ~/web/saviweb/local-pacakges meteor/pacakges`
* run `cd meteor && meteor`
* go to `localhost:3000`, click *Run*, and check the terminal outputs.

## Test code

### wait_for_all

```
// Capturing variable test 1
var A = 1;
wait_for_all([function() {
    sleep(0.1);
    print("1 A = " + A + " // 1");
    A = 2;
}, function() {
    sleep(0.2);
    print("2 A = " + A + " // 1");
    A = 3;
}, function() {
    print("3 A = " + A + " // 1");
    A = 4;
}]);
print("4 A = " + A + " // 4");
```

```
// Capturing variable test 2
var A = 1;
wait_for_all([function() {
    print("A = " + A + " // 1");
    A = 2;
    wait_for_all([function() {
        print("A = " + A + " // 2");
        A = 3;
    }]);
}, function() {
    print("A = " + A + " // 1");
    A = 4;
}]);
print("A = " + A + " // 4");
```

```
// Function test 1
var a = 1;
var set_a_to_2 = function(a) {
    print("f1 a = " + a + " // 1");
    a = 2;
    print("f2 a = " + a + " // 2");
};

set_a_to_2(a);
print("1 a = " + a + " // 1");

wait_for_all([function() {
    print("2 a = " + a + " // 1");
    set_a_to_2(a);
    print("3 a = " + a + " // 1");
}]);
print("4 a = " + a + " // 1");
```

```
// Function test 2 (~ Function test 1 + Capturing variable test 1)
var a = 1;
var test = function(a) {
    print("1 a = " + a + " // 1");
    a = 2;
    print("2 a = " + a + " // 2");
    wait_for_all([function() {
        print("3 a = " + a + " // 2");
        a = 3;
    }, function() {
        sleep(0.001);
        print("4 a = " + a + " // 2");
        a = 4;
        print("5 a = " + a + " // 4");
    }]);
    print("6 a = " + a + " // 4");
};
test(a);
print("7 a = " + a + " // 1");
```

```
// Function test 3
var a = 1;
var set_a_to_2 = function(a) {
    print("f1 a = " + a + " // 4 and 1");
    a = 2;
    print("f2 a = " + a + " // 2");
};
var test = function(a) {
    wait_for_all([function() {
        sleep(0.1);
        print("3 a = " + a + " // 1");
        set_a_to_2(a);
        print("4 a = " + a + " // 1");
    }, function() {
        print("1 a = " + a + " // 1");
        a = 4;
        set_a_to_2(a);
        print("2 a = " + a + " // 4");
    }]);
    print("5 a = " + a + " // 4");
};
test(a);
print("6 a = " + a + " // 1");
```
