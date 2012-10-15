/**
 * User management
 */
Class.create("UserFul", Provider, {
  type: 'user',
  public: ["id", "name", "loggedIn"],

  initialize : function($super, store){
    $super(store);
    this.store.setUniq(["name", "SECRET_TOKEN"]);
  },

  /* @server
   * Authentication
   */
  put : function($super, cb, name, content, options){
    if (isServer){
      var password = options.password
      if (!content && password){
        this.login(cb, name, options);
      } else{
        // Update user with content
        $super(cb, name, content, options)
      }
    } else{
      // Update user with content on Client
      $super(cb, name, content, options)
    }
  },

  login : function(cb, name, options){
    var self = this;
    var onFind = function(user){
      if (user && user.password == options.password){
        var diff = {name: name};
        diff.loggedIn = true;
        diff.lastLogin = (new Date).toJSON();

        //TODO generate token
        diff.token = "asdf";
        
        // Save user connection id as session to pass security check on sending reply
        diff.session = options.sender;

        // Save logged user on right password
        self.put(cb, user.id, diff, options);
      } else{
        // wrong password
        cb(null, "Not Found");
      }
    }
    // If password specified - Find user by login name to check password
    this.get(onFind, name, options);
  },

  register : function(){
  },

  logout : function(){
  },

  setCurrentUser : function(){
  }
})
