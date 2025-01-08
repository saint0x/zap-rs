use std::fmt;
use hyper::StatusCode;

#[derive(Debug, Clone)]
pub enum Error {
    RouteNotFound(String),
    Internal(String),
    Middleware(String),
}

impl Error {
    pub fn status_code(&self) -> StatusCode {
        match self {
            Error::RouteNotFound(_) => StatusCode::NOT_FOUND,
            Error::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::Middleware(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::RouteNotFound(path) => write!(f, "Route not found: {}", path),
            Error::Internal(msg) => write!(f, "Internal error: {}", msg),
            Error::Middleware(msg) => write!(f, "Middleware error: {}", msg),
        }
    }
}

impl std::error::Error for Error {} 