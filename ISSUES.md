# Router Implementation Issues

## Core Problems

1. **Trie Node Modification and Ownership**
   - **Issue**: When inserting routes, we're cloning the root node (`Arc::new(self.clone())`), which means we're working on a copy instead of modifying the actual trie.
   - **Impact**: Routes aren't being properly registered, leading to `RouteNotFound` errors.
   - **Goal**: Need to modify the actual trie structure while maintaining thread safety.
   - **Current Attempts**: 
     - Tried using DashMap's entry API but hit lifetime issues
     - Tried cloning with Arc but lost modifications
     - Tried keeping entry guards alive but hit borrow checker issues

2. **DashMap and Borrow Checker Conflicts**
   - **Issue**: DashMap's entry API and value access patterns conflict with Rust's borrow checker rules.
   - **Impact**: Can't maintain references across iterations while building the trie.
   - **Goal**: Need a way to safely traverse and modify the trie structure.
   - **Current Attempts**:
     - Tried using `entry().or_insert()` but hit temporary value lifetime issues
     - Tried manual get/insert pattern but lost atomicity
     - Tried keeping guards alive but hit scope issues

3. **Thread Safety vs Performance**
   - **Issue**: Need to balance thread-safe operations with performance.
   - **Impact**: Current implementation either sacrifices thread safety or has unnecessary cloning.
   - **Goal**: O(1) operations for route lookups while maintaining thread safety.
   - **Current Attempts**:
     - Using Arc<TrieNode> for shared ownership
     - Using DashMap for concurrent access
     - But struggling with modification patterns

## Conceptual Challenges

1. **Route Tree Structure**
   - Need to maintain a thread-safe tree structure
   - Must support path parameters (`:id`), wildcards (`*`), and exact matches
   - Must handle concurrent modifications and lookups
   - Current design might be too complex

2. **Parameter Handling**
   - Path parameters need to be extracted and stored
   - Query parameters need to be parsed
   - Parameter validation needs to be thread-safe
   - Current implementation isn't handling these consistently

3. **Handler Management**
   - Route handlers need to be stored and retrieved efficiently
   - Must maintain proper lifetimes for async handlers
   - Need to handle cloning and moving of handlers correctly

## Potential Solutions to Explore

1. **Alternative Data Structures**
   - Consider using a different concurrent data structure
   - Maybe RwLock or Mutex with a more traditional tree
   - Could split the structure into read-optimized and write-optimized parts

2. **Immutable Route Registration**
   - Consider making route registration non-concurrent
   - Build the entire trie structure at startup
   - Use immutable references for lookups

3. **Different Concurrency Model**
   - Re-evaluate if we need fine-grained concurrency
   - Consider using message passing for modifications
   - Could use a read-copy-update (RCU) pattern

## Questions for Higher Dev Team

1. **Architecture**
   - Is the current trie-based approach the best for our needs?
   - Should we separate route registration and lookup into different structures?
   - How important is concurrent route modification vs startup-only registration?

2. **Performance Requirements**
   - What are the actual performance requirements for route lookups?
   - How often do routes need to be modified at runtime?
   - What's the expected ratio of reads to writes?

3. **Safety vs Complexity**
   - Is the current complexity worth the thread safety guarantees?
   - Should we simplify by restricting when routes can be modified?
   - Are there specific thread safety requirements we're missing?

## Next Steps

1. Need guidance on:
   - Acceptable performance trade-offs
   - Required level of thread safety
   - Expected usage patterns
   - Priority of features (dynamic routes vs static routes)

2. Technical investigation needed for:
   - Alternative concurrent data structures
   - Different synchronization primitives
   - Simplified design approaches
   - Performance benchmarking of different approaches 