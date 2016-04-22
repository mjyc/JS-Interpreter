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

    var self = { interpreter: null };

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

      function createThreads(interpreters) {
        function runThread(interp) {
          return new Promise(function(resolve, reject) {
            var parentScope = interp.parentInterpreter.getScope();
            // Copy the parent scope to the thread scope
            while (parentScope) {
              for (var name in parentScope.properties) {
                if (!(name in interp.getScope().properties)) {
                  interp.getScope().properties[name] = parentScope.properties[name];
                }
              }
              parentScope = parentScope.parentScope;
            }
            // Save the final thread scope
            interp.finalScope = null;
            function nextStep() {
              try {
                if (interp.step()) {
                  if (interp.stateStack.length === 1) {  // right before the last step
                    interp.finalScope = interp.getScope();
                  }
                  Meteor.setTimeout(nextStep, 0);
                } else {
                  resolve(true);
                }
              } catch (e) {
                reject(e);
              }
            }
            nextStep(interp);
          });
        }
        return Meteor.wrapAsync(function(callback) {
          Promise.all(interpreters.map(runThread)).then(function(results) {
            console.log("wait_for_all results:", results);
            for (var i = 0; i < interpreters.length; i++) {
              for (var name in interpreters[i].finalScope.properties) {
                interpreters[i].parentInterpreter.setValueToScope(name, interpreters[i].finalScope.properties[name]);
              }
            }
            callback(null, null);
          }).catch(function(err) {
            console.error("wait_for_all error:", err);
            callback(null, null);
          });
        });
      }

      interpreter.setProperty(scope, 'wait_for_all', interpreter.createNativeFunction(
        function(branches_obj) {
          // self.mostRecentPrimitive = {
          //   name: 'endProgram',
          //   args: []
          // };
          var branches = [];
          var branchCode = [];
          var branchInterpreters = [];
          for (var i = 0; i < branches_obj.length; i++) {
            var branch = branches_obj.properties[i];
            branches.push(branch);
            branchCode.push(interpreter.code.substring(branches[i].node.start + 12, branches[i].node.end - 1));
            branchInterpreters.push(new Interpreter(branchCode[i], initApi));
            branchInterpreters[i].code = branchCode[i];
            branchInterpreters[i].parentInterpreter = interpreter;
          }
          createThreads(branchInterpreters)();
          return interpreter.createPrimitive(true);
        }
      ));
    }

    Meteor.methods({
      runCode: function (code) {
        self.interpreter = new Interpreter(code, initApi);
        self.interpreter.code = code;
        console.log("====PROGRAM START====");
        self.interpreter.run();
        console.log("====PROGRAM END====");
      }
    });

  });

}
