/**
 * Abstract container any type of pane that can resize
 */
Class.create("Pane", {	
	
	__implements : "IWidget",
	
	/**
	 * Constructor
	 * @param htmlElement HTMLElement The Node anchor
	 * @param options Object The pane parameters
	 */
	initialize : function(htmlElement, options){
		this.htmlElement = $(htmlElement);
		if(!this.htmlElement){
			throw new Error('Cannot find element for Pane : ' + this.__className);
		}
		this.options = options || {};
		this.htmlElement.ajxpPaneObject = this;
		if(this.htmlElement.getAttribute('ajxpPaneHeader')){
			this.addPaneHeader(
				this.htmlElement.getAttribute('ajxpPaneHeader'), 
				this.htmlElement.getAttribute('ajxpPaneIcon'));
		}
        if(this.htmlElement && this.options.elementStyle){
            this.htmlElement.setStyle(this.options.elementStyle);
        }
		this.childrenPanes = $A([]);
		this.scanChildrenPanes(this.htmlElement);
	},
	
	/**
	 * Called when the pane is resized
	 */
	resize : function(){		
		// Default behaviour : resize children
    	if(this.options.fit && this.options.fit == 'height'){
    		var marginBottom = 0;
    		if(this.options.fitMarginBottom){
    			var expr = this.options.fitMarginBottom;
    			try{marginBottom = parseInt(eval(expr));}catch(e){}
    		}
    		fitHeightToBottom(this.htmlElement, (this.options.fitParent ? $(this.options.fitParent) : null), expr);
    	}
    	this.childrenPanes.invoke('resize');
	},
	
	/**
	 * Implementation of the IWidget methods
	 */	
	getDomNode : function(){
		return this.htmlElement;
	},
	
	/**
	 * Implementation of the IWidget methods
	 */	
	destroy : function(){
        this.childrenPanes.each(function(child){
            child.destroy();
        });
        this.htmlElement.update("");
        if(window[this.htmlElement.id]){
            delete window[this.htmlElement.id];
        }
		this.htmlElement = null;

	},
	
	/**
	 * Find and reference direct children IWidget
	 * @param element HTMLElement
	 */
	scanChildrenPanes : function(element){
		if(!element.childNodes) return;
		$A(element.childNodes).each(function(c){
			if(c.ajxpPaneObject) {
				this.childrenPanes.push(c.ajxpPaneObject);
			}else{
				this.scanChildrenPanes(c);
			}
		}.bind(this));
	},
	
	/**
	 * Show the main html element
	 * @param show Boolean
	 */
	showElement : function(show){
		if(show){
			this.htmlElement.show();
		}else{
			this.htmlElement.hide();
		}
	},
	
	/**
	 * Adds a simple haeder with a title and icon
	 * @param headerLabel String The title
	 * @param headerIcon String Path for the icon image
	 */
	addPaneHeader : function(headerLabel, headerIcon){
        var header = new Element('div', {className: 'panelHeader', ajxp_message_id: headerLabel}).update(MessageHash[headerLabel]);
        if(headerIcon){
            var ic = resolveImageSource(headerIcon, '/image/actions/ICON_SIZE', 16);
            header.insert({top: new Element("img", {src: ic, className: 'panelHeaderIcon'})});
            header.addClassName('panelHeaderWithIcon');
        }
        if(this.options.headerClose){
            var ic = resolveImageSource(this.options.headerClose.icon, '/image/actions/ICON_SIZE', 16);
            var img = new Element("img", {src: ic, className: 'panelHeaderCloseIcon', title: MessageHash[this.options.headerClose.title]});
            header.insert({top: img});
            var sp = this.options.headerClose.splitter;
            img.observe("click", function(){
                window[sp]["fold"]();
            });
        }
		this.htmlElement.insert({top : header});
		disableTextSelection(header);
	},
	
	/**
	 * Sets a listener when the htmlElement is focused to notify ajaxplorer object
	 */
	setFocusBehaviour : function(){
		this.htmlElement.observe("click", function(){
			if(ajaxplorer) ajaxplorer.focusOn(this);
		}.bind(this));
	},


    getUserPreference : function(prefName){
        if(!ajaxplorer || !ajaxplorer.user) return;
        var gui_pref = ajaxplorer.user.getPreference("gui_preferences", true);
        if(!gui_pref || !gui_pref[this.htmlElement.id+"_"+this.__className]) return;
        return gui_pref[this.htmlElement.id+"_"+this.__className][prefName];
    },

    setUserPreference : function(prefName, prefValue){
        if(!ajaxplorer || !ajaxplorer.user) return;
        var guiPref = ajaxplorer.user.getPreference("gui_preferences", true);
        if(!guiPref) guiPref = {};
        if(!guiPref[this.htmlElement.id+"_"+this.__className]) guiPref[this.htmlElement.id+"_"+this.__className] = {};
        if(guiPref[this.htmlElement.id+"_"+this.__className][prefName] && guiPref[this.htmlElement.id+"_"+this.__className][prefName] == prefValue){
            return;
        }
        guiPref[this.htmlElement.id+"_"+this.__className][prefName] = prefValue;
        ajaxplorer.user.setPreference("gui_preferences", guiPref, true);
        ajaxplorer.user.savePreference("gui_preferences");
    }
});
