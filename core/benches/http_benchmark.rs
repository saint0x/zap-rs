//! Performance benchmarks for Zap HTTP framework
//!
//! Run with: cargo bench
//! For detailed profiling: cargo bench -- --profile-time=5

use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};
use zap_core::{HttpParser, Method, Router};

// ============================================================================
// HTTP Parser Benchmarks
// ============================================================================

fn parser_benchmarks(c: &mut Criterion) {
    let parser = HttpParser::new();

    // Simple GET request
    let simple_get = b"GET /api/users HTTP/1.1\r\nHost: example.com\r\n\r\n";
    c.bench_function("parse_simple_get", |b| {
        b.iter(|| parser.parse_request(black_box(simple_get)))
    });

    // GET request with query parameters
    let get_with_query = b"GET /api/users?page=1&limit=20&sort=created_at&order=desc HTTP/1.1\r\nHost: example.com\r\n\r\n";
    c.bench_function("parse_get_with_query", |b| {
        b.iter(|| parser.parse_request(black_box(get_with_query)))
    });

    // POST request with multiple headers
    let post_with_headers = b"POST /api/users HTTP/1.1\r\nHost: api.example.com\r\nContent-Type: application/json\r\nContent-Length: 50\r\nAuthorization: Bearer token123\r\nAccept: application/json\r\nUser-Agent: ZapTest/1.0\r\nX-Request-ID: req-12345\r\n\r\n{\"name\":\"John Doe\",\"email\":\"john@example.com\"}";
    c.bench_function("parse_post_with_headers", |b| {
        b.iter(|| parser.parse_request(black_box(post_with_headers)))
    });

    // Large body request parsing
    let mut large_body = Vec::from(&b"POST /api/data HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/json\r\nContent-Length: 10000\r\n\r\n"[..]);
    large_body.extend_from_slice(&vec![b'x'; 10000]);
    c.bench_function("parse_large_body", |b| {
        b.iter(|| parser.parse_request(black_box(&large_body)))
    });

    // Many headers parsing (stress test)
    let mut many_headers = String::from("GET / HTTP/1.1\r\n");
    for i in 0..50 {
        many_headers.push_str(&format!("X-Header-{}: value-{}\r\n", i, i));
    }
    many_headers.push_str("\r\n");
    let many_headers_bytes = many_headers.into_bytes();
    c.bench_function("parse_many_headers", |b| {
        b.iter(|| parser.parse_request(black_box(&many_headers_bytes)))
    });
}

// ============================================================================
// Router Benchmarks
// ============================================================================

fn router_benchmarks(c: &mut Criterion) {
    // Static route lookup
    let mut static_router: Router<&str> = Router::new();
    static_router.insert(Method::GET, "/api/users", "users_handler").unwrap();
    static_router.insert(Method::GET, "/api/posts", "posts_handler").unwrap();
    static_router.insert(Method::GET, "/api/comments", "comments_handler").unwrap();
    static_router.insert(Method::GET, "/health", "health_handler").unwrap();

    c.bench_function("router_static_route", |b| {
        b.iter(|| static_router.at(black_box(Method::GET), black_box("/api/users")))
    });

    // Parameterized route lookup
    let mut param_router: Router<&str> = Router::new();
    param_router.insert(Method::GET, "/api/users/:id", "user_handler").unwrap();
    param_router.insert(Method::GET, "/api/posts/:id", "post_handler").unwrap();
    param_router.insert(Method::GET, "/api/posts/:id/comments/:cid", "comment_handler").unwrap();

    c.bench_function("router_param_route", |b| {
        b.iter(|| param_router.at(black_box(Method::GET), black_box("/api/users/12345")))
    });

    // Deep nested route lookup
    let mut deep_router: Router<&str> = Router::new();
    deep_router.insert(Method::GET, "/api/v1/organizations/:org/teams/:team/members/:member/permissions/:perm", "handler").unwrap();

    c.bench_function("router_deep_route", |b| {
        b.iter(|| deep_router.at(black_box(Method::GET), black_box("/api/v1/organizations/acme/teams/engineering/members/john/permissions/read")))
    });

    // Wildcard route lookup
    let mut wildcard_router: Router<&str> = Router::new();
    wildcard_router.insert(Method::GET, "/static/**path", "static_handler").unwrap();

    c.bench_function("router_wildcard_route", |b| {
        b.iter(|| wildcard_router.at(black_box(Method::GET), black_box("/static/js/app/bundle.min.js")))
    });

    // Router with many routes (realistic API)
    let mut many_routes: Router<&str> = Router::new();
    let resources = ["users", "posts", "comments", "products", "orders", "categories", "tags", "reviews"];

    for resource in &resources {
        many_routes.insert(Method::GET, &format!("/api/{}", resource), "list").unwrap();
        many_routes.insert(Method::POST, &format!("/api/{}", resource), "create").unwrap();
        many_routes.insert(Method::GET, &format!("/api/{}/:id", resource), "get").unwrap();
        many_routes.insert(Method::PUT, &format!("/api/{}/:id", resource), "update").unwrap();
        many_routes.insert(Method::DELETE, &format!("/api/{}/:id", resource), "delete").unwrap();
    }
    many_routes.insert(Method::GET, "/api/users/:id/posts", "user_posts").unwrap();
    many_routes.insert(Method::GET, "/api/posts/:id/comments", "post_comments").unwrap();

    c.bench_function("router_many_routes", |b| {
        b.iter(|| {
            black_box(many_routes.at(Method::GET, "/api/users"));
            black_box(many_routes.at(Method::GET, "/api/users/123"));
            black_box(many_routes.at(Method::POST, "/api/posts"));
            black_box(many_routes.at(Method::GET, "/api/users/456/posts"));
        })
    });
}

// ============================================================================
// Combined Benchmarks (Parser + Router)
// ============================================================================

fn full_flow_benchmarks(c: &mut Criterion) {
    let parser = HttpParser::new();

    let mut router: Router<&str> = Router::new();
    router.insert(Method::GET, "/api/users/:id", "user_handler").unwrap();
    router.insert(Method::POST, "/api/users", "create_user").unwrap();

    // Full GET request flow
    let get_request = b"GET /api/users/123 HTTP/1.1\r\nHost: api.example.com\r\nAccept: application/json\r\n\r\n";

    c.bench_function("full_get_flow", |b| {
        b.iter(|| {
            let parsed = parser.parse_request(black_box(get_request)).unwrap();
            let path_only = parsed.path.split('?').next().unwrap_or(parsed.path);
            router.at(parsed.method, path_only)
        })
    });

    // Full POST request flow
    let post_request = b"POST /api/users HTTP/1.1\r\nHost: api.example.com\r\nContent-Type: application/json\r\nContent-Length: 35\r\n\r\n{\"name\":\"test\",\"email\":\"t@t.com\"}";

    c.bench_function("full_post_flow", |b| {
        b.iter(|| {
            let parsed = parser.parse_request(black_box(post_request)).unwrap();
            let path_only = parsed.path.split('?').next().unwrap_or(parsed.path);
            let _ = router.at(parsed.method, path_only);
            // Simulate body access
            black_box(&post_request[parsed.body_offset..])
        })
    });
}

// ============================================================================
// Throughput Benchmarks
// ============================================================================

fn throughput_benchmarks(c: &mut Criterion) {
    let parser = HttpParser::new();
    let request = b"GET /api/users/123 HTTP/1.1\r\nHost: api.example.com\r\nAccept: application/json\r\nUser-Agent: ZapBench/1.0\r\n\r\n";

    let mut group = c.benchmark_group("throughput");
    group.throughput(Throughput::Bytes(request.len() as u64));

    group.bench_function("request_parsing", |b| {
        b.iter(|| parser.parse_request(black_box(request)))
    });

    group.finish();
}

criterion_group!(
    benches,
    parser_benchmarks,
    router_benchmarks,
    full_flow_benchmarks,
    throughput_benchmarks
);
criterion_main!(benches);
