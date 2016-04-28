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
    class ParallelInterpreter extends Interpreter {
      constructor(code, parentInterpreter, opt_initFunc) {
        super(code, opt_initFunc);
        this.code = code;
        this._parentInterpreter = parentInterpreter;
        this._initScopeProperties = {};
        this._finalScope = undefined;
        this._stopped = false;
        // Copy the parent scope to the thread scope
        let parentScope = this._parentInterpreter.getScope();
        while (parentScope) {
          for (let name in parentScope.properties) {
            if (!(name in super.getScope().properties)) {
              super.getScope().properties[name] = parentScope.properties[name];
              this._initScopeProperties[name] = parentScope.properties[name];
            }
          }
          parentScope = parentScope.parentScope;
        }
      }
      copyFinalScopeToParentScope() {
        // Check if this interpreter is at the end
        if (this.isFinished()) {
          for (let name in this._finalScope.properties) {
            if (this._initScopeProperties.hasOwnProperty(name) &&
                this._initScopeProperties[name] === this._finalScope.properties[name]) {
              continue;  // Don't change since the variable "name" wasn't updated
            }
            this._parentInterpreter.setValueToScope(name, this._finalScope.properties[name]);
          }
          return true;
        } else {
          return false;
        }
      }
      step() {
        if (this._stopped)
          return false;
        const ret = super.step();
        if (this.stateStack.length === 1) {  // right before the last step
          this._finalScope = super.getScope();
        }
        return ret;
      }
      runAsync() {
        return new Promise((resolve, reject) => {
          const self = this;
          function nextStep() {
            try {
              if (self.step()) {
                Meteor.setTimeout(nextStep, 0);
              } else {
                resolve(self);
              }
            } catch (e) {
              reject(e);
            }
          }
          nextStep();
        });
      }
      stopAsync() {
        this._stopped = true;
      }
      isFinished() {
        return this._finalScope && this.stateStack.length === 0;
      }
    }

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
          let branches = [];
          let branchCode = [];
          let branchInterpreters = [];
          for (let i = 0; i < branches_obj.length; i++) {
            let branch = branches_obj.properties[i];
            branches.push(branch);
            branchCode.push(interpreter.code.substring(branches[i].node.start + 12, branches[i].node.end - 1));
            branchInterpreters.push(new ParallelInterpreter(branchCode[i], interpreter, initApi));
          }
          return Meteor.wrapAsync(callback => {
            Promise.all(branchInterpreters.map(interp => interp.runAsync())).then(results => {
              for (let i = 0; i < results.length; i++) {
                if (!results[i].copyFinalScopeToParentScope()) {
                  return Promise.reject('Failed to copy final scope to parent scope');
                }
              }
              console.error(`wait_for_all done`);
              callback(null, true);
            }).catch(err => {
              console.error(`wait_for_all error: ${err}`);
              callback(null, false);
            });
          })();
        }
      ));

      interpreter.setProperty(scope, 'wait_for_one', interpreter.createNativeFunction(
        function(branches_obj) {
          // self.mostRecentPrimitive = {
          //   name: 'endProgram',
          //   args: []
          // };
          let branches = [];
          let branchCode = [];
          let branchInterpreters = [];
          for (let i = 0; i < branches_obj.length; i++) {
            let branch = branches_obj.properties[i];
            branches.push(branch);
            branchCode.push(interpreter.code.substring(branches[i].node.start + 12, branches[i].node.end - 1));
            branchInterpreters.push(new ParallelInterpreter(branchCode[i], interpreter, initApi));
          }
          return Meteor.wrapAsync(callback => {
            Promise.race(branchInterpreters.map(interp => interp.runAsync())).then(result => {
              branchInterpreters.map(interp => interp.stopAsync());
              if (!result.copyFinalScopeToParentScope()) {
                return Promise.reject('Failed to copy final scope to parent scope');
              }
              console.error(`wait_for_one done`);
              callback(null, true);
            }).catch(err => {
              console.error(`wait_for_one error: ${err}`);
              callback(null, false);
            });
          })();
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
