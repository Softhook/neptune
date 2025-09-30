/**
 * Service Locator Pattern Implementation
 * Provides centralized service management and dependency injection
 */

import eventSystem from '../core/EventSystem.js';

class ServiceLocator {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.singletons = new Map();
    this.initializedServices = new Set();
    this.dependencies = new Map();
    
    // Service lifecycle callbacks
    this.initCallbacks = new Map();
    this.destroyCallbacks = new Map();
  }
  
  /**
   * Register a service instance
   */
  register(name, service, options = {}) {
    if (this.services.has(name)) {
      console.warn(`Service '${name}' is already registered, overriding`);
    }
    
    const serviceConfig = {
      instance: service,
      singleton: options.singleton !== false, // Default to singleton
      dependencies: options.dependencies || [],
      initialized: false,
      lazy: options.lazy || false
    };
    
    this.services.set(name, serviceConfig);
    
    // Store dependencies for resolution
    if (serviceConfig.dependencies.length > 0) {
      this.dependencies.set(name, serviceConfig.dependencies);
    }
    
    // Initialize immediately if not lazy
    if (!serviceConfig.lazy) {
      this.initializeService(name);
    }
    
    eventSystem.emit('service:registered', { name, service });
    console.log(`Service registered: ${name}`);
  }
  
  /**
   * Register a service factory function
   */
  registerFactory(name, factory, options = {}) {
    if (this.factories.has(name)) {
      console.warn(`Factory '${name}' is already registered, overriding`);
    }
    
    const factoryConfig = {
      factory,
      singleton: options.singleton !== false,
      dependencies: options.dependencies || [],
      lazy: options.lazy || false
    };
    
    this.factories.set(name, factoryConfig);
    
    if (factoryConfig.dependencies.length > 0) {
      this.dependencies.set(name, factoryConfig.dependencies);
    }
    
    console.log(`Factory registered: ${name}`);
  }
  
  /**
   * Get a service instance
   */
  get(name) {
    // Check for direct service instance
    if (this.services.has(name)) {
      const config = this.services.get(name);
      
      if (!config.initialized) {
        this.initializeService(name);
      }
      
      return config.instance;
    }
    
    // Check for factory
    if (this.factories.has(name)) {
      const config = this.factories.get(name);
      
      // Return singleton instance if exists
      if (config.singleton && this.singletons.has(name)) {
        return this.singletons.get(name);
      }
      
      // Create new instance
      const dependencies = this.resolveDependencies(name);
      const instance = config.factory(...dependencies);
      
      // Store singleton
      if (config.singleton) {
        this.singletons.set(name, instance);
      }
      
      // Initialize if needed
      this.initializeServiceInstance(name, instance);
      
      return instance;
    }
    
    throw new Error(`Service '${name}' not found`);
  }
  
  /**
   * Check if a service is registered
   */
  has(name) {
    return this.services.has(name) || this.factories.has(name);
  }
  
  /**
   * Resolve dependencies for a service
   */
  resolveDependencies(serviceName) {
    const deps = this.dependencies.get(serviceName) || [];
    const resolved = [];
    
    for (const depName of deps) {
      if (!this.has(depName)) {
        throw new Error(`Dependency '${depName}' not found for service '${serviceName}'`);
      }
      
      resolved.push(this.get(depName));
    }
    
    return resolved;
  }
  
  /**
   * Initialize a service
   */
  initializeService(name) {
    const config = this.services.get(name);
    if (!config || config.initialized) return;
    
    // Resolve dependencies first
    const dependencies = this.resolveDependencies(name);
    
    // Inject dependencies if service has init method
    if (config.instance && typeof config.instance.init === 'function') {
      config.instance.init(...dependencies);
    }
    
    config.initialized = true;
    this.initializedServices.add(name);
    
    // Call initialization callback
    this.callInitCallback(name, config.instance);
    
    eventSystem.emit('service:initialized', { name, service: config.instance });
  }
  
  /**
   * Initialize a service instance (for factories)
   */
  initializeServiceInstance(name, instance) {
    if (typeof instance.init === 'function') {
      const dependencies = this.resolveDependencies(name);
      instance.init(...dependencies);
    }
    
    this.callInitCallback(name, instance);
    eventSystem.emit('service:initialized', { name, service: instance });
  }
  
  /**
   * Unregister a service
   */
  unregister(name) {
    if (this.services.has(name)) {
      const config = this.services.get(name);
      
      // Call destroy callback
      this.callDestroyCallback(name, config.instance);
      
      // Clean up
      this.services.delete(name);
      this.initializedServices.delete(name);
      this.dependencies.delete(name);
      
      eventSystem.emit('service:unregistered', { name });
      console.log(`Service unregistered: ${name}`);
    }
    
    if (this.factories.has(name)) {
      this.factories.delete(name);
      this.singletons.delete(name);
      this.dependencies.delete(name);
      console.log(`Factory unregistered: ${name}`);
    }
  }
  
  /**
   * Set initialization callback for a service
   */
  onInit(serviceName, callback) {
    if (!this.initCallbacks.has(serviceName)) {
      this.initCallbacks.set(serviceName, []);
    }
    this.initCallbacks.get(serviceName).push(callback);
  }
  
  /**
   * Set destruction callback for a service
   */
  onDestroy(serviceName, callback) {
    if (!this.destroyCallbacks.has(serviceName)) {
      this.destroyCallbacks.set(serviceName, []);
    }
    this.destroyCallbacks.get(serviceName).push(callback);
  }
  
  /**
   * Call initialization callbacks
   */
  callInitCallback(serviceName, service) {
    const callbacks = this.initCallbacks.get(serviceName) || [];
    for (const callback of callbacks) {
      try {
        callback(service);
      } catch (error) {
        console.error(`Error in init callback for service '${serviceName}':`, error);
      }
    }
  }
  
  /**
   * Call destruction callbacks
   */
  callDestroyCallback(serviceName, service) {
    const callbacks = this.destroyCallbacks.get(serviceName) || [];
    for (const callback of callbacks) {
      try {
        callback(service);
      } catch (error) {
        console.error(`Error in destroy callback for service '${serviceName}':`, error);
      }
    }
  }
  
  /**
   * Initialize all lazy services
   */
  initializeAll() {
    // Initialize services first
    for (const [name, config] of this.services.entries()) {
      if (!config.initialized) {
        this.initializeService(name);
      }
    }
    
    // Initialize factory singletons
    for (const [name, config] of this.factories.entries()) {
      if (config.singleton && !this.singletons.has(name)) {
        this.get(name); // This will create and initialize the singleton
      }
    }
  }
  
  /**
   * Create a scoped service locator
   */
  createScope(name) {
    const scope = new ServiceLocator();
    
    // Copy services to scope
    for (const [serviceName, config] of this.services.entries()) {
      scope.services.set(serviceName, { ...config });
    }
    
    for (const [factoryName, config] of this.factories.entries()) {
      scope.factories.set(factoryName, { ...config });
    }
    
    scope.dependencies = new Map(this.dependencies);
    
    console.log(`Created service scope: ${name}`);
    return scope;
  }
  
  /**
   * Inject dependencies into an object
   */
  inject(target, dependencies) {
    for (const [property, serviceName] of Object.entries(dependencies)) {
      if (this.has(serviceName)) {
        target[property] = this.get(serviceName);
      } else {
        console.warn(`Cannot inject '${serviceName}' into '${property}': service not found`);
      }
    }
    
    return target;
  }
  
  /**
   * Create a service proxy for lazy loading
   */
  createProxy(serviceName) {
    const self = this;
    
    return new Proxy({}, {
      get(target, property) {
        const service = self.get(serviceName);
        const value = service[property];
        
        if (typeof value === 'function') {
          return value.bind(service);
        }
        
        return value;
      },
      
      set(target, property, value) {
        const service = self.get(serviceName);
        service[property] = value;
        return true;
      },
      
      has(target, property) {
        const service = self.get(serviceName);
        return property in service;
      }
    });
  }
  
  /**
   * Get service dependency graph
   */
  getDependencyGraph() {
    const graph = {};
    
    for (const [serviceName, deps] of this.dependencies.entries()) {
      graph[serviceName] = [...deps];
    }
    
    return graph;
  }
  
  /**
   * Validate dependency graph for circular dependencies
   */
  validateDependencies() {
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (serviceName) => {
      if (recursionStack.has(serviceName)) {
        return true; // Circular dependency found
      }
      
      if (visited.has(serviceName)) {
        return false; // Already processed
      }
      
      visited.add(serviceName);
      recursionStack.add(serviceName);
      
      const deps = this.dependencies.get(serviceName) || [];
      for (const dep of deps) {
        if (hasCycle(dep)) {
          return true;
        }
      }
      
      recursionStack.delete(serviceName);
      return false;
    };
    
    for (const serviceName of this.dependencies.keys()) {
      if (hasCycle(serviceName)) {
        throw new Error(`Circular dependency detected involving service: ${serviceName}`);
      }
    }
    
    return true;
  }
  
  /**
   * Get all registered service names
   */
  getServiceNames() {
    const services = Array.from(this.services.keys());
    const factories = Array.from(this.factories.keys());
    return [...services, ...factories];
  }
  
  /**
   * Get service statistics
   */
  getStats() {
    return {
      totalServices: this.services.size,
      totalFactories: this.factories.size,  
      initializedServices: this.initializedServices.size,
      singletons: this.singletons.size,
      servicesWithDependencies: this.dependencies.size,
      serviceNames: this.getServiceNames()
    };
  }
  
  /**
   * Clear all services
   */
  clear() {
    // Call destroy callbacks for all services
    for (const [name, config] of this.services.entries()) {
      this.callDestroyCallback(name, config.instance);
    }
    
    for (const [name, instance] of this.singletons.entries()) {
      this.callDestroyCallback(name, instance);
    }
    
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
    this.initializedServices.clear();
    this.dependencies.clear();
    this.initCallbacks.clear();
    this.destroyCallbacks.clear();
    
    eventSystem.emit('service:allCleared');
    console.log('All services cleared');
  }
  
  /**
   * Debug information
   */
  debug() {
    console.group('Service Locator Debug');
    console.log('Services:', Array.from(this.services.keys()));
    console.log('Factories:', Array.from(this.factories.keys()));
    console.log('Singletons:', Array.from(this.singletons.keys()));
    console.log('Dependencies:', Object.fromEntries(this.dependencies));
    console.log('Initialized:', Array.from(this.initializedServices));
    console.groupEnd();
  }
}

// Create singleton instance
const serviceLocator = new ServiceLocator();

export default serviceLocator;