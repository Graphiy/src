/**
 * Implementation of the INodeProvider interface based on a remote server access.
 * Default for all repositories.
 */
Class.create("RemoteNodeProvider", {
	__implements : "INodeProvider",
	/**
	 * Constructor
	 */
	initialize : function(){
		
	},
	/**
	 * Initialize properties
	 * @param properties Object
	 */
	initProvider : function(properties){
		this.properties = properties;
	},
	/**
	 * Load a node
	 * @param node Node
	 * @param nodeCallback Function On node loaded
	 * @param childCallback Function On child added
	 */
	loadNode : function(node, nodeCallback, childCallback){
		var conn = new Connexion();
		conn.addParameter("get_action", "ls");
		conn.addParameter("options", "al");
		var path = node.getPath();
		// Double encode # character
		if(node.getMetadata().get("paginationData")){
			path += "%23" + node.getMetadata().get("paginationData").get("current");
		}
		conn.addParameter("dir", path);
		if(this.properties){
			$H(this.properties).each(function(pair){
				conn.addParameter(pair.key, pair.value);
			});
		}
		conn.onComplete = function (transport){
			try{				
				this.parseNodes(node, transport, nodeCallback, childCallback);
			}catch(e){
				if(ajaxplorer) ajaxplorer.displayMessage('ERROR', 'Loading error:'+e.message);
				else alert('Loading error:'+ e.message);
			}
		}.bind(this);	
		conn.sendAsync();
	},
	/**
	 * Parse the answer and create Nodes
	 * @param origNode Node
	 * @param transport Ajax.Response
	 * @param nodeCallback Function
	 * @param childCallback Function
	 */
	parseNodes : function(origNode, transport, nodeCallback, childCallback){
		if(!transport.responseXML || !transport.responseXML.documentElement) return;
		var rootNode = transport.responseXML.documentElement;
		var children = rootNode.childNodes;
		var contextNode = this.parseNode(rootNode);
		origNode.replaceBy(contextNode);
		
		// CHECK FOR MESSAGE OR ERRORS
		var errorNode = XPathSelectSingleNode(rootNode, "error|message");
		if(errorNode){
			if(errorNode.nodeName == "message") type = errorNode.getAttribute('type');
			if(type == "ERROR"){
				origNode.notify("error", errorNode.firstChild.nodeValue + '(Source:'+origNode.getPath()+')');				
			}			
		}
		
		// CHECK FOR PAGINATION DATA
		var paginationNode = XPathSelectSingleNode(rootNode, "pagination");
		if(paginationNode){
			var paginationData = new Hash();
			$A(paginationNode.attributes).each(function(att){
				paginationData.set(att.nodeName, att.nodeValue);
			}.bind(this));
			origNode.getMetadata().set('paginationData', paginationData);
		}else if(origNode.getMetadata().get('paginationData')){
			origNode.getMetadata().unset('paginationData');
		}

		// CHECK FOR COMPONENT CONFIGS CONTEXTUAL DATA
		var configs = XPathSelectSingleNode(rootNode, "client_configs");
		if(configs){
			origNode.getMetadata().set('client_configs', configs);
		}		

		// NOW PARSE CHILDREN
		var children = XPathSelectNodes(rootNode, "tree");
		children.each(function(childNode){
			var child = this.parseNode(childNode);
			origNode.addChild(child);
			if(childCallback){
				childCallback(child);
			}
		}.bind(this) );

		if(nodeCallback){
			nodeCallback(origNode);
		}
	},
	/**
	 * Parses XML Node and create Node
	 * @param xmlNode XMLNode
	 * @returns Node
	 */
	parseNode : function(xmlNode){
		var node = new Node(
			xmlNode.getAttribute('filename'), 
			(xmlNode.getAttribute('is_file') == "1" || xmlNode.getAttribute('is_file') == "true"), 
			xmlNode.getAttribute('text'),
			xmlNode.getAttribute('icon'));
		var reserved = ['filename', 'is_file', 'text', 'icon'];
		var metadata = new Hash();
		for(var i=0;i<xmlNode.attributes.length;i++)
		{
			metadata.set(xmlNode.attributes[i].nodeName, xmlNode.attributes[i].nodeValue);
			if(Prototype.Browser.IE && xmlNode.attributes[i].nodeName == "ID"){
				metadata.set("ajxp_sql_"+xmlNode.attributes[i].nodeName, xmlNode.attributes[i].nodeValue);
			}
		}
		// BACKWARD COMPATIBILIY
		//metadata.set("XML_NODE", xmlNode);
		node.setMetadata(metadata);
		return node;
	}
});
