"use strict";

/**
 * @namespace
 */
var Resource = {};

/**
 * @class Resource.Controller
 * @extends meta.Controller
 * @property resources {Object} Map for all resources that are currently managed. Uses Resource.Type to access specific type.
 * @property resourceInUse {Object} Map with all resource that are in use.
 * @property rootPath {string} Root path of resources that's added at resource creation time.
 * @memberof! <global>
 */
Resource.Controller = meta.Controller.extend
( /** @lends Resource.Controller.prototype */ {

	/**
	 * Constructor.
	 */
	init: function()
	{
		this.resources = {};
		this.resourcesInUse = {};

		this._chn = meta.createChannel("Resource");

		// Bind temp canvas to Resource.Texture
		var canvas = document.createElement("canvas");
		Resource.Texture.prototype._tmpImg = canvas;
		Resource.Texture.prototype._tmpCtx = canvas.getContext("2d");

		var proto = Resource.Sound.prototype;
		if(meta.device.isAudioAPI) 
		{
			proto._context = new AudioContext();

			console.log("%cAudio: %cWebAudio ", 
				"font-weight: bold; padding: 2px 0 2px 0;", 
				"padding: 2px 0 2px 0;");	
		}
		else 
		{
			proto._loadFromUrl = proto._loadFromUrl_legacy;
			proto._clear = proto._clear_legacy;
			proto._createInstance = proto._createInstance_legacy;
			proto._syncLoading = true;

			console.log("%cAudio: %c<audio> ", 
				"font-weight: bold; padding: 2px 0 1px 0; width: 500px;", 
				"padding: 2px 0 1px 0;");				
		}
	},


	/**
	 * Add a resource for managing.
	 * @param resource {Resource.Basic} Resource to add.
	 * @return {Resource.Basic|null} Resource added.
	 */
	add: function(resource)
	{
		var subBuffer = this.resources[resource.type];
		if(!subBuffer) {
			subBuffer = {};
			this.resources[resource.type] = subBuffer;
		}

		// If no name is specified take it from the source.
		var path = resource.path;
		if(resource.name === "unknown" && path)
		{
			var pointIndexOf = path.lastIndexOf(".");
			var slashIndexOf = path.lastIndexOf("/");

			if(pointIndexOf < 0) { pointIndexOf = path.length; }

			resource.name = path.slice(slashIndexOf + 1, pointIndexOf);
		}

		if(subBuffer[resource.name])
		{
			console.warn("[Resource.Manager.add]:",
				"There is already a resource(" + meta.enumToString(Resource.Type, resource.type) + ") added with a name: " + resource.name);
			return null;
		}

		subBuffer[resource.name] = resource;

		this._chn.emit(resource, Resource.Event.ADDED);

		return resource;
	},

	/**
	 * Remove resource from the managing.
	 * @param resource {Resource.Basic} Resource to remove.
	 */
	remove: function(resource)
	{
		var subBuffer = this.resources[resource.type];
		if(!subBuffer)
		{
			console.warn("[Resource.Manager.remove]:",
				"Resource(" + meta.enumToString(Resource.Type, resource.type) + ")(" + resource.name + ") is not added to the manager.");
			return;
		}

		if(!subBuffer[resource.name])
		{
			console.warn("[Resource.Manager.remove]:",
				"Resource(" + meta.enumToString(Resource.Type, resource.type) + ")(" + resource.name + ") is not added to the manager.");
			return;
		}

		subBuffer[resource.name] = null;
	},


	/**
	 * Flag texture that must be loaded.
	 * @param resource {Resource.Basic} Resource to load. 
	 */
	addToLoad: function(resource)
	{
		resource.isLoading = true;

		if(!meta.engine.isReady) {
			this.numToLoad++;
		}
	},

	/**
	 * Load resource to "inUse" buffer.
	 * @param resource {Resource.Basic}
	 */
	loadSuccess: function(resource)
	{
		var subBuffer = this.resourcesInUse[resource.type];
		if(!subBuffer) {
			subBuffer = [];
			this.resourcesInUse[resource.type] = subBuffer;
		}

		subBuffer.push(resource);
		resource.isLoading = false;
		resource.inUse = true;

		if(!meta.engine.isReady)
		{
			this.numToLoad--;
			this.numLoaded++;

			if(this.numToLoad === 0 && !meta.engine.isLoading) {
				meta.engine.onResourcesLoaded();
				this._chn.emit(this, Resource.Event.ALL_LOADED);
			}
		}
	},

	/**
	 * Remove flag that resource is loading.
	 * @param resource {Resource.Basic}
	 */
	loadFailed: function(resource)
	{
		resource.isLoading = false;

		if(!meta.engine.isReady)
		{
			this.numToLoad--;

			if(this.numToLoad === 0 && !meta.engine.isLoading) {
				meta.engine.onResourcesLoaded();
				this._chn.emit(this, Resource.Event.ALL_LOADED);
			}
		}
	},


	/**
	 * Get texture by name.
	 * @param name {String} Name of the texture resource.
	 * @returns {Resource.Texture|null} Texture from the manager.
	 */
	getTexture: function(name)
	{
		if(!name) {
			console.warn("[Resource.Manager.getTexture]:", "No name specified.");
			return null;
		}

		var subBuffer = this.resources[Resource.Type.TEXTURE];
		if(!subBuffer) {
			return null;
		}

		var texture = subBuffer[name];
		if(!texture) {
			return null;
		}

		return texture;
	},

	/**
	 * Get sound by name.
	 * @param name {String} Name of the sound resource.
	 * @returns {Resource.Sound|null} Sound from the manager.
	 */
	getSound: function(name)
	{
		if(!name) {
			console.warn("[Resource.Manager.getSound]:", "No name specified.");
			return null;
		}

		var subBuffer = this.resources[Resource.Type.SOUND];
		if(!subBuffer) {
			return null;
		}

		var sound = subBuffer[name];
		if(!sound) {
			return null;
		}

		return sound;
	},	


	/**
	 * Add resource loading into queue to guarantee synchronous loading.
	 * @param resource {Resource.Basic} Resource to queue.
	 */
	addToQueue: function(resource) 
	{
		if(!this._syncQueue) {
			this._syncQueue = [];
		}

		this._syncQueue.push(resource);
	},

	/** 
	 * Load next resource from queue.
	 */
	loadNextFromQueue: function() 
	{
		this.isSyncLoading = false;

		if(!this._syncQueue || !this._syncQueue.length) { 
			return; 
		}

		this._syncQueue[this._syncQueue.length - 1].forceLoad(true);
		this._syncQueue.pop();
	},


	/**
	 * Get unique id.
	 * @return {number} Generated unique id.
	 */
	getUniqueID: function() {
		return ++this._uniqueID;
	},


	//
	resources: null,
	resourcesInUse: null,
	rootPath: "",

	numLoaded: 0,
	numToLoad: 0,

	_syncQueue: null,
	isSyncLoading: false,

	_chn: null,
	_uniqueID: 0
});