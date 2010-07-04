// ifmap.js
// Copyright (c) 2010 Andrew Benton
// This software is distributed under the MIT license. See LICENSE for details.

function IfmapClient(proxyURI, mapURI) {
  this.proxy = !!proxyURI ? proxyURI : '';
  this.server = !!mapURI ? mapURI : '';
  var sessionId = '';
  var publisherId = '';
  this.namespaces = { 'ifmap': 'http://www.trustedcomputinggroup.org/2006/IFMAP/1',
                      'meta':  'http://www.trustedcomputinggroup.org/2006/IFMAP-METADATA/1' }
  this.request = '';
  
  // SOAP actions
  ////////////////////////////////////////////////////////////////////////
  
  /////// New Session ///////
  this.newSession = function(callback) {
    var soapBody = new XMLObject('ifmap:new-session');
    var soapRequest = new SOAPRequest('new-session', soapBody);
    $.each(this.namespaces, function(key, value) { soapRequest.addNamespace(key, value) });
    this.request = soapRequest.toXML();
    $.post(this.proxy, 'url='+this.server+'&soap='+this.request, $.proxy(function(data, status, xhr) {
      if (status == 'success') {
        var soapResponse = $(data['soap']);
        this.sessionId = soapResponse.find('ifmap\\:session-id:first').text();
        this.publisherId = soapResponse.find('ifmap\\:publisher-id:first').text();
        callback(data, status, xhr);
      }
    }, this), 'json');
  };

  /////// Update ///////
  this.publishUpdate = function(identifiers, metadata, callback) {
    var soapHeader = new XMLObject('ifmap:session-id');
    soapHeader.val(this.sessionId);
    var soapBody = new XMLObject('ifmap:publish');
    var update = new XMLObject('update');
    if (identifiers.length == 1) {
      update.appendChild(identifiers[0].xml());
    } else if (identifiers.length == 2) {
      link = new XMLObject('link');
      link.appendChild(identifiers[0].xml()).appendChild(identifiers[1].xml());
      update.appendChild(link);
    }
    update.appendChild(metadata.xml());
    soapBody.appendChild(update);
    var soapRequest = new SOAPRequest('publish', soapBody);
    $.each(this.namespaces, function(key, value) { soapRequest.addNamespace(key, value) });
    soapRequest.addHeader(soapHeader);
    this.request = soapRequest.toXML();
    $.post(this.proxy, 'url='+this.server+'&soap='+this.request, callback, 'json');
  };
  
  /////// Delete ///////
  this.publishDelete = function(identifiers, filter, callback) {
    var soapHeader = new XMLObject('ifmap:session-id');
    soapHeader.val(this.sessionId);
    var soapBody = new XMLObject('ifmap:publish');
    if (!!filter) { soapBody.attr('filter', filter) }
    var del = new XMLObject('delete');
    if (identifiers.length == 1) {
      del.appendChild(identifiers[0].xml());
    } else if (identifiers.length == 2) {
      link = new XMLObject('link');
      link.appendChild(identifiers[0].xml()).appendChild(identifiers[1].xml());
      del.appendChild(link);
    }
    soapBody.appendChild(del);
    var soapRequest = new SOAPRequest('delete', soapBody);
    $.each(this.namespaces, function(key, value) { soapRequest.addNamespace(key, value) });
    soapRequest.addHeader(soapHeader);
    this.request = soapRequest.toXML();
    $.post(this.proxy, 'url='+this.server+'&soap='+this.request, callback, 'json');
  };
  
  /////// Search ///////
  this.search = function(identifier, params, callback) {
    var soapHeader = new XMLObject('ifmap:session-id');
    soapHeader.val(this.sessionId);
    var soapBody = new XMLObject('ifmap:search');
    $.each( params, function(key, value) {
      soapBody.attr(key, value);
    });
    soapBody.val(identifier.toXML());
    var soapRequest = new SOAPRequest('search', soapBody);
    $.each(this.namespaces, function(key, value) { soapRequest.addNamespace(key, value) });
    soapRequest.addHeader(soapHeader);
    this.request = soapRequest.toXML();
    $.post(this.proxy, 'url='+this.server+'&soap='+this.request, callback, 'json');
  };

  /////// Purge Publisher ///////
  this.purgePublisher = function(callback) {
    var soapHeader = new XMLObject('ifmap:session-id');
    soapHeader.val(this.sessionId);
    var soapBody = new XMLObject('ifmap:purgePublisher');
    soapBody.attr('publisher-id', this.publisherId);
    var soapRequest = new SOAPRequest('purgePublisher', soapBody);
    $.each(this.namespaces, function(key, value) { soapRequest.addNamespace(key, value) });
    soapRequest.addHeader(soapHeader);
    this.request = soapRequest.toXML();
    $.post(this.proxy, 'url='+this.server+'&soap='+this.request, callback, 'json');
  };
} // End IfmapClient definition

function IfmapIdentifier(type, attributes) {
  this.type = !!type ? type : '';
  this.attributes = !!attributes ? attributes : {};
  
  var xml = new XMLObject('identifier');
  var innerXml = new XMLObject(this.type);
  
  $.each(this.attributes, function(key, value) { innerXml.attr(key, value) });
  
  xml.appendChild(innerXml);
  
  this.xml = function() { return xml };
  this.toXML = function() { return xml.toXML() };
}

function IfmapMetadata(type, params) {
  this.type = !!type ? type : '';
  this.params = !!params ? params : {};
  
  var xml = new XMLObject('metadata');
  var innerXml = new XMLObject('meta:' + this.type);
  
  $.each(this.params, function(key, value) { innerXml.attr(key, value) });
  
  xml.appendChild(innerXml);
  
  this.xml = function() { return xml };
  this.toXML = function() { return xml.toXML() };
}

// An object to handle construction of SOAP requests
function SOAPRequest(action, xmlObj) {
  this.action = action;  
  var nss = [];
  var headers = [];
  var bodies = (!!xmlObj && xmlObj.typeOf == 'XMLObject') ? [xmlObj] : [];
  
  this.addNamespace = function(ns, uri) { nss.push({'name': ns, 'uri': uri}) };
  this.addHeader = function(xmlObj) { if (xmlObj.typeOf == 'XMLObject') { headers.push(xmlObj) } };
  this.addBody = function(xmlObj) { if (xmlObj.typeOf == 'XMLObject') { bodies.push(xmlObj) } };
  
  this.toXML = function() {
    var soapEnv = new XMLObject('soapenv:Envelope');
    soapEnv.attr('xmlns:soapenv','http://schemas.xmlsoap.org/soap/envelope/');
    $.each(nss, function(i, ns) { soapEnv.attr('xmlns:' + ns.name, ns.uri) });
    if (headers.length > 0) {
      var soapHeader = new XMLObject('soapenv:Header');
      soapEnv.appendChild(soapHeader);
      $.each(headers, function(i, header) { soapHeader.appendChild(header) });
    }
    if (bodies.length > 0) {
      var soapBody = new XMLObject('soapenv:Body');
      soapEnv.appendChild(soapBody);
      $.each(bodies, function(i, body) { soapBody.appendChild(body) });
    }
    return soapEnv.toXML();
  };
};

// XML Object
function XMLObject(name) {
  this.typeOf = 'XMLObject';
  this.name = name;
  this.attributes = [];
  this.children = [];
  this.value = null;
  
  this.attr = function(name, value) { this.attributes.push({'name': name, 'value': value}); return this; };
  this.appendChild = function(obj) { if (obj.typeOf == 'XMLObject') { this.children.push(obj); return this; } };
  this.val = function(value) { if (!value) { return this.value; } else { this.value = value; return this; } };
  
  this.toXML = function() {
    var xml = [];
    xml.push('<' + this.name);
    $.each(this.attributes, function(i, attribute) {
      xml.push(' ' + attribute.name + '="' + attribute.value + '"');
    });
    xml.push('>');     
    $.each(this.children, function(i, child) {
      if (typeof(child) === "object") { xml.push(child.toXML()) }
    });
    if (!!this.value) { xml.push(this.value) }
    xml.push('</' + this.name + '>');
    return xml.join('');
  }
}
