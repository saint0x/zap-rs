use napi_derive::napi;
use std::fmt;

#[napi]
#[derive(Debug, Clone)]
pub enum ErrorKind {
    NotFound,
    BadRequest,
    Unauthorized,
    Forbidden,
    InternalServerError,
}

impl fmt::Display for ErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorKind::NotFound => write!(f, "Not Found"),
            ErrorKind::BadRequest => write!(f, "Bad Request"),
            ErrorKind::Unauthorized => write!(f, "Unauthorized"),
            ErrorKind::Forbidden => write!(f, "Forbidden"),
            ErrorKind::InternalServerError => write!(f, "Internal Server Error"),
        }
    }
}

#[napi]
#[derive(Debug, Clone)]
pub struct ZapError {
    pub kind: ErrorKind,
    pub message: String,
}

impl ZapError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::NotFound, message)
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::BadRequest, message)
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Unauthorized, message)
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Forbidden, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::InternalServerError, message)
    }
}

impl fmt::Display for ZapError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.kind, self.message)
    }
}

impl std::error::Error for ZapError {}

impl From<ZapError> for napi::Error {
    fn from(error: ZapError) -> Self {
        napi::Error::from_reason(error.to_string())
    }
} 