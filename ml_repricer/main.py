"""
MercadoLibre Auto-Repricer — Argentina (MLA)

Uso:
  Primera vez:       python -m ml_repricer --auth
  Repricing manual:  python -m ml_repricer
  Ver ayuda:         python -m ml_repricer --help
"""

import argparse
import logging
import sys

from dotenv import load_dotenv

load_dotenv()

from .auth import MLAuth
from .client import MLClient
from .repricer import Repricer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("repricer.log", encoding="utf-8"),
    ],
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="MercadoLibre Auto-Repricer (Argentina)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--auth",
        action="store_true",
        help="Iniciar el flujo OAuth2 para obtener tokens de acceso",
    )
    args = parser.parse_args()

    auth = MLAuth()

    if args.auth or not auth.access_token:
        if not auth.client_id or not auth.client_secret:
            print(
                "\nError: Completá ML_CLIENT_ID y ML_CLIENT_SECRET en el archivo .env\n"
                "Copiá .env.example → .env y completá los valores.\n"
            )
            sys.exit(1)
        auth.first_time_auth()
        return

    if not auth.user_id:
        print("No se encontró ML_USER_ID en .env. Corré --auth primero.")
        sys.exit(1)

    client = MLClient(auth)
    repricer = Repricer(client)
    repricer.run()


if __name__ == "__main__":
    main()
