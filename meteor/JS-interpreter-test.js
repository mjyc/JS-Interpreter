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
    Interpreter.prototype.stepThread = function(parentInterpreter) {
      if (this.step() && this.stateStack.length > 0) {
        if (this.stateStack[0].node.type === 'ExpressionStatement' && !this.stateStack[0].done) {
          // Copy global scope to local scope
          for (var key in parentInterpreter.getGlobalScope().properties) {
            this.getGlobalScope().properties[key] = parentInterpreter.getGlobalScope().properties[key];
          }
        } else if (this.stateStack[0].node.type === 'AssignmentExpression' &&
                   this.stateStack[0].doneLeft &&
                   this.stateStack[0].doneRight) {
          // Copy local scope to global scope
          // Assumes variable declaration is done only in global scope
          parentInterpreter.getGlobalScope().properties[this.stateStack[0].leftSide.data] = this.stateStack[0].value;
        }
        return true;
      } else {
        return false;
      }
    };

    var code = "var A = 1; print(A);\n";
    var self = {};
    function initApi(interpreter, scope) {
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
          var code0 = code.substring(branches[0].node.start + 13, branches[0].node.end - 2);
          var code1 = code.substring(branches[1].node.start + 13, branches[1].node.end - 2);
          var interp0 = new Interpreter(code0, initApi);
          var interp1 = new Interpreter(code1, initApi);

          function runThread(interp) {
            return new Promise(function(resolve, reject) {
              function nextStep() {
                if (interp.stepThread(self.interpreter)) {
                  Meteor.setTimeout(nextStep, 0);
                } else {
                  resolve(true);
                }
              }
              nextStep(interp);
            });
          }

          var runThreads = Meteor.wrapAsync(function(callback) {
            Promise.all([runThread(interp0), runThread(interp1)]).then(function(results) {
              console.log("runThreads results:", results);
              callback(null, null);
            }).catch(function(err) {
              console.error("runThreads error:", err);
              callback(null, null);
            });
          });
          runThreads();
          console.log('Done!', self.interpreter.stateStack.length);
          return interpreter.createPrimitive(true);
        }
      ));
    };

    self.interpreter = new Interpreter(code, initApi);
    self.interpreter.run();
  });

}
