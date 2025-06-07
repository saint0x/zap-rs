use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use zap_core::{Router, Method};

/// Benchmark static route lookups
fn bench_static_routes(c: &mut Criterion) {
    let mut router = Router::new();
    
    // Add realistic routes
    let routes = [
        "/",
        "/health", 
        "/api/v1/users",
        "/api/v1/posts",
        "/api/v1/comments",
        "/api/v2/users",
        "/api/v2/posts", 
        "/admin/dashboard",
        "/admin/users",
        "/admin/settings",
    ];

    for (i, route) in routes.iter().enumerate() {
        router.insert(Method::GET, route, i).unwrap();
    }

    let mut group = c.benchmark_group("static_routes");
    
    for route in &routes {
        group.bench_with_input(
            BenchmarkId::new("lookup", route),
            route,
            |b, route| {
                b.iter(|| {
                    black_box(router.at(Method::GET, black_box(route)))
                })
            },
        );
    }
    
    group.finish();
}

/// Benchmark parameter route lookups  
fn bench_param_routes(c: &mut Criterion) {
    let mut router = Router::new();
    
    // Add parameter routes
    router.insert(Method::GET, "/users/:id", "get_user").unwrap();
    router.insert(Method::GET, "/users/:id/posts/:post_id", "get_post").unwrap();
    router.insert(Method::GET, "/users/:id/posts/:post_id/comments/:comment_id", "get_comment").unwrap();
    router.insert(Method::GET, "/api/v1/users/:user_id/orders/:order_id/items/:item_id", "get_item").unwrap();

    let test_paths = [
        "/users/123",
        "/users/456/posts/789",
        "/users/123/posts/456/comments/789",
        "/api/v1/users/user123/orders/order456/items/item789",
    ];

    let mut group = c.benchmark_group("param_routes");
    
    for path in &test_paths {
        group.bench_with_input(
            BenchmarkId::new("lookup", path),
            path,
            |b, path| {
                b.iter(|| {
                    black_box(router.at(Method::GET, black_box(path)))
                })
            },
        );
    }
    
    group.finish();
}

/// Benchmark wildcard routes
fn bench_wildcard_routes(c: &mut Criterion) {
    let mut router = Router::new();
    
    router.insert(Method::GET, "/static/*filepath", "serve_static").unwrap();
    router.insert(Method::GET, "/downloads/**path", "serve_download").unwrap();

    let test_paths = [
        "/static/css/main.css",
        "/static/js/app.js",
        "/static/images/logo.png",
        "/downloads/software/v1.0/installer.exe",
        "/downloads/docs/api/reference.pdf",
    ];

    let mut group = c.benchmark_group("wildcard_routes");
    
    for path in &test_paths {
        group.bench_with_input(
            BenchmarkId::new("lookup", path),
            path,
            |b, path| {
                b.iter(|| {
                    black_box(router.at(Method::GET, black_box(path)))
                })
            },
        );
    }
    
    group.finish();
}

/// Benchmark route insertion performance
fn bench_route_insertion(c: &mut Criterion) {
    let mut group = c.benchmark_group("route_insertion");

    group.bench_function("static_routes", |b| {
        b.iter(|| {
            let mut router = Router::new();
            for i in 0..100 {
                let path = format!("/api/v1/resource{}", i);
                router.insert(Method::GET, &path, i).unwrap();
            }
            black_box(router)
        })
    });

    group.bench_function("param_routes", |b| {
        b.iter(|| {
            let mut router = Router::new();
            for i in 0..100 {
                let path = format!("/api/v1/resource{}/:id", i);
                router.insert(Method::GET, &path, i).unwrap();
            }
            black_box(router)
        })
    });

    group.finish();
}

/// Benchmark large routing table performance
fn bench_large_routing_table(c: &mut Criterion) {
    let sizes = [100, 500, 1000, 5000];
    
    for size in &sizes {
        let mut router = Router::new();
        
        // Build large routing table
        for i in 0..*size {
            let static_route = format!("/api/v1/resource{}", i);
            let param_route = format!("/api/v1/resource{}/:id", i);
            let nested_route = format!("/api/v1/resource{}/nested/:id/deep", i);
            
            router.insert(Method::GET, &static_route, format!("handler_{}", i)).unwrap();
            router.insert(Method::POST, &param_route, format!("create_{}", i)).unwrap();
            router.insert(Method::PUT, &nested_route, format!("update_{}", i)).unwrap();
        }

        c.bench_with_input(
            BenchmarkId::new("large_table_lookup", size),
            &router,
            |b, router| {
                let test_path = format!("/api/v1/resource{}", size / 2);
                b.iter(|| {
                    black_box(router.at(Method::GET, black_box(&test_path)))
                })
            },
        );
    }
}

/// Benchmark different HTTP methods
fn bench_http_methods(c: &mut Criterion) {
    let mut router = Router::new();
    
    let methods = [
        Method::GET,
        Method::POST,
        Method::PUT,
        Method::DELETE,
        Method::PATCH,
    ];

    for method in &methods {
        router.insert(*method, "/api/users/:id", format!("handler_{}", method)).unwrap();
    }

    let mut group = c.benchmark_group("http_methods");
    
    for method in &methods {
        group.bench_with_input(
            BenchmarkId::new("method_lookup", format!("{}", method)),
            method,
            |b, method| {
                b.iter(|| {
                    black_box(router.at(*method, black_box("/api/users/123")))
                })
            },
        );
    }
    
    group.finish();
}

/// Benchmark parameter extraction performance
fn bench_param_extraction(c: &mut Criterion) {
    let mut router = Router::new();
    router.insert(Method::GET, "/users/:id/posts/:post_id/comments/:comment_id", "handler").unwrap();

    c.bench_function("param_extraction", |b| {
        b.iter(|| {
            if let Some((_, params)) = router.at(Method::GET, "/users/user123/posts/post456/comments/comment789") {
                black_box(params.get("id"));
                black_box(params.get("post_id"));
                black_box(params.get("comment_id"));
                black_box(params.get_u64("id"));
                black_box(params.parse::<u64>("post_id"));
            }
        })
    });
}

criterion_group!(
    router_benches,
    bench_static_routes,
    bench_param_routes,
    bench_wildcard_routes,
    bench_route_insertion,
    bench_large_routing_table,
    bench_http_methods,
    bench_param_extraction
);

criterion_main!(router_benches); 