/**
 * Full container of the data tree. Contains the SelectionModel as well.
 */
Class.create("DataModel", {

	_currentRep: undefined, 
	_isEmpty: undefined,
	_isUnique: false,
	_isFile: false,
	_isDir: false,
	_isRecycle: false,
	
	_pendingContextPath: null, 
	_pendingSelection: null,
	_selectionSource : {}, // fake object
	
	_rootNode : null,

	/**
	 * Constructor
	 */
	initialize : function(){
		this._currentRep = '/';
		this._selectedNodes = $A([]);
		this._isEmpty = true;
	},
	
	/**
	 * Sets the data source that will feed the nodes with children.
	 * @param iNodeProvider INodeProvider 
	 */
	setNodeProvider : function(iNodeProvider){
		this._iNodeProvider = iNodeProvider;
	},
	
	/**
	 * Changes the current context node.
	 * @param ajxpNode Node Target node, either an existing one or a fake one containing the target part.
	 * @param forceReload Boolean If set to true, the node will be reloaded even if already loaded.
	 */
	requireContextChange : function(ajxpNode, forceReload){
		var path = ajxpNode.getPath();
		if((path == "" || path == "/") && ajxpNode != this._rootNode){
			ajxpNode = this._rootNode;
		}
		if(ajxpNode.getMetadata().get('paginationData') && ajxpNode.getMetadata().get('paginationData').get('new_page') 
			&& ajxpNode.getMetadata().get('paginationData').get('new_page') != ajxpNode.getMetadata().get('paginationData').get('current')){
				var paginationPage = ajxpNode.getMetadata().get('paginationData').get('new_page');
				forceReload = true;			
		}
		if(ajxpNode != this._rootNode && (!ajxpNode.getParent() || ajxpNode.fake)){
			// Find in arbo or build fake arbo
			var fakeNodes = [];
			ajxpNode = ajxpNode.findInArbo(this._rootNode, fakeNodes);
			if(fakeNodes.length){
				var firstFake = fakeNodes.shift();
				firstFake.observeOnce("first_load", function(e){					
					this.requireContextChange(ajxpNode);
				}.bind(this));
				firstFake.observeOnce("error", function(message){
					ajaxplorer.displayMessage("ERROR", message);
					firstFake.notify("node_removed");
					var parent = firstFake.getParent();
					parent.removeChild(firstFake);
					delete(firstFake);
					this.requireContextChange(parent);
				}.bind(this) );
				document.fire("ajaxplorer:context_loading");
				firstFake.load(this._iNodeProvider);
				return;
			}
		}		
		ajxpNode.observeOnce("loaded", function(){
			this.setContextNode(ajxpNode, true);			
			document.fire("ajaxplorer:context_loaded");
		}.bind(this));
		ajxpNode.observeOnce("error", function(message){
			ajaxplorer.displayMessage("ERROR", message);
			document.fire("ajaxplorer:context_loaded");
		}.bind(this));
		document.fire("ajaxplorer:context_loading");
		try{
			if(forceReload){
				if(paginationPage){
					ajxpNode.getMetadata().get('paginationData').set('current', paginationPage);
				}
				ajxpNode.reload(this._iNodeProvider);
			}else{
				ajxpNode.load(this._iNodeProvider);
			}
		}catch(e){
			document.fire("ajaxplorer:context_loaded");
		}
	},
	
	/**
	 * Sets the root of the data store
	 * @param ajxpRootNode Node The parent node
	 */
	setRootNode : function(ajxpRootNode){
		this._rootNode = ajxpRootNode;
		this._rootNode.setRoot();
		this._rootNode.observe("child_added", function(c){
				//console.log(c);
		});
		document.fire("ajaxplorer:root_node_changed", this._rootNode);
		this.setContextNode(this._rootNode);
	},
	
	/**
	 * Gets the current root node
	 * @returns Node
	 */
	getRootNode : function(ajxpRootNode){
		return this._rootNode;
	},
	
	/**
	 * Sets the current context node
	 * @param ajxpDataNode Node
	 * @param forceEvent Boolean If set to true, event will be triggered even if the current node is already the same.
	 */
	setContextNode : function(ajxpDataNode, forceEvent){
		if(this._contextNode && this._contextNode == ajxpDataNode && this._currentRep  == ajxpDataNode.getPath() && !forceEvent){
			return; // No changes
		}
		this._contextNode = ajxpDataNode;
		this._currentRep = ajxpDataNode.getPath();
		document.fire("ajaxplorer:context_changed", ajxpDataNode);
	},
	
	/**
	 * Get the current context node
	 * @returns Node
	 */
	getContextNode : function(){
		return this._contextNode;
	},
	
	/**
	 * After a copy or move operation, many nodes may have to be reloaded
	 * This function tries to reload them in the right order and if necessary.
	 * @param nodes Nodes[] An array of nodes
	 */
	multipleNodesReload : function(nodes){
		nodes = $A(nodes);
		for(var i=0;i<nodes.length;i++){
			var nodePathOrNode = nodes[i];
			var node;
			if(Object.isString(nodePathOrNode)){
				node = new Node(nodePathOrNode);	
				if(node.getPath() == this._rootNode.getPath()) node = this._rootNode;
				else node = node.findInArbo(this._rootNode, []);
			}else{
				node = nodePathOrNode;
			}
			nodes[i] = node;		
		}
		var children = $A([]);
		nodes.sort(function(a,b){
			if(a.isParentOf(b)){
				children.push(b);
				return -1;
			}
			if(a.isChildOf(b)){
				children.push(a);
				return +1;
			}
			return 0;
		});
		children.each(function(c){
			nodes = nodes.without(c);
		});
		nodes.each(this.queueNodeReload.bind(this));
		this.nextNodeReloader();
	},
	
	/**
	 * Add a node to the queue of nodes to reload.
	 * @param node Node
	 */
	queueNodeReload : function(node){
		if(!this.queue) this.queue = [];
		if(node){
			this.queue.push(node);
		}
	},
	
	/**
	 * Queue processor for the nodes to reload
	 */
	nextNodeReloader : function(){
		if(!this.queue.length) {
			window.setTimeout(function(){
				document.fire("ajaxplorer:context_changed", this._contextNode);
			}.bind(this), 200);
			return;
		}
		var next = this.queue.shift();
		var observer = this.nextNodeReloader.bind(this);
		next.observeOnce("loaded", observer);
		next.observeOnce("error", observer);
		if(next == this._contextNode || next.isParentOf(this._contextNode)){
			this.requireContextChange(next, true);
		}else{
			next.reload(this._iNodeProvider);
		}
	},
	
	/**
	 * Sets an array of nodes to be selected after the context is (re)loaded
	 * @param selection Node[]
	 */
	setPendingSelection : function(selection){
		this._pendingSelection = selection;
	},
	
	/**
	 * Gets the array of nodes to be selected after the context is (re)loaded
	 * @returns Node[]
	 */
	getPendingSelection : function(){
		return this._pendingSelection;
	},
	
	/**
	 * Clears the nodes to be selected
	 */
	clearPendingSelection : function(){
		this._pendingSelection = null;
	},
	
	/**
	 * Set an array of nodes as the current selection
	 * @param ajxpDataNodes Node[] The nodes to select
	 * @param source String The source of this selection action
	 */
	setSelectedNodes : function(ajxpDataNodes, source){
		if(!source){
			this._selectionSource = {};
		}else{
			this._selectionSource = source;
		}
		this._selectedNodes = $A(ajxpDataNodes);
		this._isEmpty = !(ajxpDataNodes && ajxpDataNodes.length);
		this._isFile = this._isDir = this._isRecycle = false;
		if(!this._isEmpty)
		{
			this._isUnique = !!(ajxpDataNodes.length == 1);
			for(var i=0; i<ajxpDataNodes.length; i++)
			{
				var selectedNode = ajxpDataNodes[i];
				if(selectedNode.isLeaf()) this._isFile = true;
				else this._isDir = true;
				if(selectedNode.isRecycle()) this._isRecycle = true;
			}
		}
		document.fire("ajaxplorer:selection_changed", this);	
	},
	
	/**
	 * Gets the currently selected nodes
	 * @returns Node[]
	 */
	getSelectedNodes : function(){
		return this._selectedNodes;
	},
	
	/**
	 * Gets the source of the last selection action
	 * @returns String
	 */
	getSelectionSource : function(){
		return this._selectionSource;
	},
	
	/**
	 * DEPRECATED
	 */
	getSelectedItems : function(){
		throw new Error("Deprecated : use getSelectedNodes() instead");
	},
	
	/**
	 * Select all the children of the current context node
	 */
	selectAll : function(){
		this.setSelectedNodes(this._contextNode.getChildren(), "dataModel");
	},
	
	/**
	 * Whether the selection is empty
	 * @returns Boolean
	 */
	isEmpty : function (){
		return (this._selectedNodes ? (this._selectedNodes.length==0) : true);
	},
	
	/**
	 * Whether the selection is unique
	 * @returns Boolean
	 */
	isUnique : function (){
		return this._isUnique;
	},
	
	/**
	 * Whether the selection has a file selected.
	 * Should be hasLeaf
	 * @returns Boolean
	 */
	hasFile : function (){
		return this._isFile;
	},
	
	/**
	 * Whether the selection has a dir selected
	 * @returns Boolean
	 */
	hasDir : function (){
		return this._isDir;
	},
			
	/**
	 * Whether the current context is the recycle bin
	 * @returns Boolean
	 */
	isRecycle : function (){
		return this._isRecycle;
	},
	
	/**
	 * DEPRECATED. Should use getCurrentNode().getPath() instead.
	 * @returns String
	 */
	getCurrentRep : function (){
		return this._currentRep;
	},
	
	/**
	 * Whether the selection has more than one node selected
	 * @returns Boolean
	 */
	isMultiple : function(){
		if(this._selectedNodes && this._selectedNodes.length > 1) return true;
		return false;
	},
	
	/**
	 * Whether the selection has a file with one of the mimes
	 * @param mimeTypes Array Array of mime types
	 * @returns Boolean
	 */
	hasMime : function(mimeTypes){
		if(mimeTypes.length==1 && mimeTypes[0] == "*") return true;
		var has = false;
		mimeTypes.each(function(mime){
			if(has) return;
			has = this._selectedNodes.any(function(node){
				return (getMimeType(node) == mime);
			});
		}.bind(this) );
		return has;
	},
	
	/**
	 * Get all selected filenames as an array.
	 * @param separator String Is a separator, will return a string joined
	 * @returns Array|String
	 */
	getFileNames : function(separator){
		if(!this._selectedNodes.length)
		{
			alert('Please select a file!');
			return false;
		}
		var tmp = new Array(this._selectedNodes.length);
		for(i=0;i<this._selectedNodes.length;i++)
		{
			tmp[i] = this._selectedNodes[i].getPath();
		}
		if(separator){
			return tmp.join(separator);
		}else{
			return tmp;
		}
	},
	
	/**
	 * Get all the filenames of the current context node children
	 * @param separator String If passed, will join the array as a string
	 * @return Array|String
	 */
	getContextFileNames : function(separator){
		var allItems = this._contextNode.getChildren();
		if(!allItems.length)
		{		
			return false;
		}
		var names = $A([]);
		for(i=0;i<allItems.length;i++)
		{
			names.push(getBaseName(allItems[i].getPath()));
		}
		if(separator){
			return names.join(separator);
		}else{
			return names;
		}
	},
	
	/**
	 * Whether the context node has a child with this basename
	 * @param newFileName String The name to check
	 * @returns Boolean
	 */
	fileNameExists: function(newFileName) 
	{	
		var allItems = this._contextNode.getChildren();
		if(!allItems.length)
		{		
			return false;
		}
		for(i=0;i<allItems.length;i++)
		{
			var meta = allItems[i].getMetadata();
			var crtFileName = getBaseName(meta.get('filename'));
			if(crtFileName && crtFileName.toLowerCase() == getBaseName(newFileName).toLowerCase()) 
				return true;
		}
		return false;
	},	
	
	/**
	 * Gets the first name of the current selection
	 * @returns String
	 */
	getUniqueFileName : function(){	
		if(this.getFileNames().length) return this.getFileNames()[0];
		return null;	
	},
	
	/**
	 * Gets the first node of the selection, or Null
	 * @returns Node
	 */
	getUniqueNode : function(){
		if(this._selectedNodes.length){
			return this._selectedNodes[0];
		}
		return null;
	},
	
	/**
	 * DEPRECATED
	 */
	getUniqueItem : function(){
		throw new Error("getUniqueItem is deprecated, use getUniqueNode instead!");
	},

	/**
	 * DEPRECATED
	 */
    getItem : function(i) {
        throw new Error("getItem is deprecated, use getNode instead!");
    },
	
    /**
     * Gets a node from the current selection
     * @param i Integer the node index
     * @returns Node
     */
    getNode : function(i) {
        return this._selectedNodes[i];
    },
	
    /**
     * Will add the current selection nodes as serializable data to the element passed : 
     * either as hidden input elements if it's a form, or as query parameters if it's an url
     * @param oFormElement HTMLForm The form
     * @param sUrl String An url to complete
     * @returns String
     */
	updateFormOrUrl : function (oFormElement, sUrl){
		// CLEAR FROM PREVIOUS ACTIONS!
		if(oFormElement)	
		{
			$(oFormElement).getElementsBySelector("input").each(function(element){
				if(element.name.indexOf("file_") != -1 || element.name=="file") element.value = "";
			});
		}
		// UPDATE THE 'DIR' FIELDS
		if(oFormElement && oFormElement.rep) oFormElement.rep.value = this._currentRep;
		sUrl += '&dir='+encodeURIComponent(this._currentRep);
		
		// UPDATE THE 'file' FIELDS
		if(this.isEmpty()) return sUrl;
		var fileNames = this.getFileNames();
		if(this.isUnique())
		{
			sUrl += '&'+'file='+encodeURIComponent(fileNames[0]);
			if(oFormElement) this._addHiddenField(oFormElement, 'file', fileNames[0]);
		}
		else
		{
			for(var i=0;i<fileNames.length;i++)
			{
				sUrl += '&'+'file_'+i+'='+encodeURIComponent(fileNames[i]);
				if(oFormElement) this._addHiddenField(oFormElement, 'file_'+i, fileNames[i]);
			}
		}
		return sUrl;
	},
	
	_addHiddenField : function(oFormElement, sFieldName, sFieldValue){
		if(oFormElement[sFieldName]) oFormElement[sFieldName].value = sFieldValue;
		else{
			var field = document.createElement('input');
			field.type = 'hidden';
			field.name = sFieldName;
			field.value = sFieldValue;
			oFormElement.appendChild(field);
		}
	}
});
