#!/usr/bin/env python3
"""
Generate self-signed SSL certificates for local development.
Usage: python generate_certs.py
"""

from datetime import datetime, timedelta
import subprocess
import sys
import os

def generate_certs_with_openssl():
    """Generate certificates using OpenSSL command line"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cert_file = os.path.join(script_dir, "server.crt")
    key_file = os.path.join(script_dir, "server.key")
    
    # Generate private key
    print("Generating private key...")
    subprocess.run([
        "openssl", "genrsa", 
        "-out", key_file,
        "2048"
    ], check=True)
    
    # Generate certificate
    print("Generating certificate (valid for 365 days)...")
    subprocess.run([
        "openssl", "req",
        "-new", "-x509",
        "-key", key_file,
        "-out", cert_file,
        "-days", "365",
        "-subj", "/C=US/ST=State/L=City/O=InvisiThreat/CN=localhost"
    ], check=True)
    
    print(f"\nCertificates generated successfully!")
    print(f"Private key: {key_file}")
    print(f"Certificate: {cert_file}")
    return True


def generate_certs_with_cryptography():
    """Generate certificates using Python cryptography library"""
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.asymmetric import rsa
    except ImportError:
        print("ERROR: cryptography library not installed")
        print("Install with: pip install cryptography")
        return False
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cert_file = os.path.join(script_dir, "server.crt")
    key_file = os.path.join(script_dir, "server.key")
    
    print("Generating private key...")
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    print("Generating certificate (valid for 365 days)...")
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, u"US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"State"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, u"City"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"InvisiThreat"),
        x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
    ])
    
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.utcnow()
    ).not_valid_after(
        datetime.utcnow() + timedelta(days=365)
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName(u"localhost"),
            x509.DNSName(u"127.0.0.1"),
            x509.DNSName(u"*.localhost"),
        ]),
        critical=False,
    ).sign(key, hashes.SHA256(), default_backend())
    
    # Write certificate
    with open(cert_file, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    
    # Write private key
    with open(key_file, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))
    
    print(f"\nCertificates generated successfully!")
    print(f"Private key: {key_file}")
    print(f"Certificate: {cert_file}")
    return True


if __name__ == "__main__":
    print("InvisiThreat SSL Certificate Generator")
    print("=" * 50)
    
    try:
        # Try OpenSSL first (if available)
        if generate_certs_with_openssl():
            sys.exit(0)
    except FileNotFoundError:
        print("OpenSSL not found, trying cryptography library...")
    
    # Fallback to cryptography
    if generate_certs_with_cryptography():
        sys.exit(0)
    else:
        print("\nFailed to generate certificates")
        sys.exit(1)
