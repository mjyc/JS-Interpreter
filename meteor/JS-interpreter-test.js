if (Meteor.isClient) {

  Template.body.events({
    "click .toggle-checked": function () {
      // Set the checked property to the opposite of its current value
      Meteor.call("setChecked", this._id, ! this.checked);
    },
    "click .delete": function () {
      Meteor.call("deleteTask", this._id);
    },
    "click .toggle-private": function () {
      Meteor.call("setPrivate", this._id, ! this.private);
    }
  });

}

if (Meteor.isClient) {
  Template.body.events({
    "click .runButton": function () {
      Meteor.call("runCode", document.getElementById('code').value);
    }
  });
}

if (Meteor.isServer) {

  Meteor.startup(function () {
    // Extend Interpreter obj
    Interpreter.prototype.getGlobalScope = function() {
      for (var i = this.stateStack.length - 1; i >= 0 ; i--) {
        if (this.stateStack[i].scope) {
          return this.stateStack[i].scope;
        }
      }
      throw 'No scope found.';
    };
    Interpreter.prototype.stepThread = function() {
      if (this.step() && this.stateStack.length > 0) {
        if (this.parentInterpreter) {
          if (this.stateStack[0].node.type === 'ExpressionStatement' && !this.stateStack[0].done) {
            // Copy global scope to local scope
            for (var key in this.parentInterpreter.getGlobalScope().properties) {
              this.getGlobalScope().properties[key] = this.parentInterpreter.getGlobalScope().properties[key];
            }
          } else if (this.stateStack[0].node.type === 'AssignmentExpression' &&
                     this.stateStack[0].doneLeft &&
                     this.stateStack[0].doneRight) {
            // Copy local scope to global scope
            // Assumes variable declaration is done only in global scope
            this.parentInterpreter.getGlobalScope().properties[this.stateStack[0].leftSide.data] = this.stateStack[0].value;
          }
        }
        return true;
      } else {
        return false;
      }
    };

    var code;
    var self = {};
    function initApi(interpreter, scope) {
      var wrapper = function(secs) {
        secs = secs ? secs.toNumber() * 1000: 0;
        return interpreter.createPrimitive(Meteor._sleepForMs(secs));
      };
      interpreter.setProperty(scope, 'sleep',
          interpreter.createNativeFunction(wrapper));

      var wrapper = function(text) {
        text = text ? text.toString() : '';
        return interpreter.createPrimitive(console.log(text));
      };
      interpreter.setProperty(scope, 'print',
          interpreter.createNativeFunction(wrapper));

      interpreter.setProperty(scope, 'wait_for_all', interpreter.createNativeFunction(
        function(branches_obj) {
          // self.mostRecentPrimitive = {
          //   name: 'endProgram',
          //   args: []
          // };
          var branches = [];
          for (var i = 0; i < branches_obj.length; i++) {
            var branch = branches_obj.properties[i];
            branches.push(branch);
          }
          var branchCode = [];
          var branchInterpreters = [];
          for (var i = 0; i < branches.length; i++) {
            branchCode.push(code.substring(branches[i].node.start + 13, branches[i].node.end - 2));
            branchInterpreters.push(new Interpreter(branchCode[i], initApi));
            branchInterpreters[i].parentInterpreter = self.interpreter;
          }

          function runThread(interp) {
            return new Promise(function(resolve, reject) {
              function nextStep() {
                if (interp.stepThread()) {
                  Meteor.setTimeout(nextStep, 0);
                } else {
                  resolve(true);
                }
              }
              nextStep(interp);
            });
          }

          var runThreads = Meteor.wrapAsync(function(callback) {
            Promise.all(branchInterpreters.map(runThread)).then(function(results) {
              console.log("runThreads results:", results);
              callback(null, null);
            }).catch(function(err) {
              console.error("runThreads error:", err);
              callback(null, null);
            });
          });
          return interpreter.createPrimitive(runThreads());
        }
      ));
    }

    Meteor.methods({
      runCode: function (inputcode) {
        code = inputcode;
        self.interpreter = new Interpreter(code, initApi);
        console.log("====STARTING PROGRAM====");
        self.interpreter.run();
        console.log("====PROGRAM ENDED====");
      }
    });

  });

}
