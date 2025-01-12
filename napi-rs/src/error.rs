use napi::Error as NapiError;
use napi_derive::napi;
use std::fmt;

#[napi]
#[derive(Debug)]
pub enum ErrorKind {
    NotFound,
    BadRequest,
    ValidationError,
    InternalError,
}

impl fmt::Display for ErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorKind::NotFound => write!(f, "Not Found"),
            ErrorKind::BadRequest => write!(f, "Bad Request"),
            ErrorKind::ValidationError => write!(f, "Validation Error"),
            ErrorKind::InternalError => write!(f, "Internal Error"),
        }
    }
}

#[napi]
#[derive(Debug)]
pub struct ZapError {
    pub kind: ErrorKind,
    pub message: String,
    pub details: Option<String>,
}

impl fmt::Display for ZapError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.kind, self.message)
    }
}

impl ZapError {
    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            kind: ErrorKind::NotFound,
            message: message.into(),
            details: None,
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            kind: ErrorKind::BadRequest,
            message: message.into(),
            details: None,
        }
    }

    pub fn validation_error(message: impl Into<String>, details: Option<String>) -> Self {
        Self {
            kind: ErrorKind::ValidationError,
            message: message.into(),
            details,
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            kind: ErrorKind::InternalError,
            message: message.into(),
            details: None,
        }
    }
}

impl From<NapiError> for ZapError {
    fn from(error: NapiError) -> Self {
        Self::internal(error.to_string())
    }
}

impl From<ZapError> for NapiError {
    fn from(error: ZapError) -> Self {
        NapiError::from_reason(error.to_string())
    }
} 