use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum Error {
    #[error("Route not found: {0}")]
    RouteNotFound(String),

    #[error("Invalid route pattern: {0}")]
    InvalidRoutePattern(String),

    #[error("Middleware error: {0}")]
    MiddlewareError(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Hyper error: {0}")]
    Hyper(String),

    #[error("IO error: {0}")]
    Io(String),
}

impl From<hyper::Error> for Error {
    fn from(err: hyper::Error) -> Self {
        Error::Hyper(err.to_string())
    }
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Error::Io(err.to_string())
    }
}

impl Error {
    pub fn status_code(&self) -> hyper::StatusCode {
        use hyper::StatusCode;
        match self {
            Error::RouteNotFound(_) => StatusCode::NOT_FOUND,
            Error::InvalidRoutePattern(_) => StatusCode::BAD_REQUEST,
            Error::MiddlewareError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::Hyper(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::Io(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
} 