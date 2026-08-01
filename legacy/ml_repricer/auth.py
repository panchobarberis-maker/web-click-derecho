import os
import webbrowser
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv, set_key

load_dotenv()

_AUTH_URL = "https://auth.mercadolibre.com.ar/authorization"
_TOKEN_URL = "https://api.mercadolibre.com/oauth/token"
_ENV_FILE = ".env"


class MLAuth:
    def __init__(self):
        self.client_id = os.getenv("ML_CLIENT_ID")
        self.client_secret = os.getenv("ML_CLIENT_SECRET")
        self.redirect_uri = os.getenv("ML_REDIRECT_URI", "https://localhost")
        self.access_token = os.getenv("ML_ACCESS_TOKEN")
        self.refresh_token = os.getenv("ML_REFRESH_TOKEN")
        self.user_id = os.getenv("ML_USER_ID")

    def get_auth_url(self) -> str:
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
        }
        return f"{_AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code: str) -> dict:
        resp = requests.post(
            _TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "redirect_uri": self.redirect_uri,
            },
        )
        resp.raise_for_status()
        return resp.json()

    def refresh_access_token(self) -> str:
        resp = requests.post(
            _TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": self.refresh_token,
            },
        )
        resp.raise_for_status()
        tokens = resp.json()
        self._save_tokens(tokens)
        self.access_token = tokens["access_token"]
        self.refresh_token = tokens.get("refresh_token", self.refresh_token)
        return self.access_token

    def _save_tokens(self, tokens: dict) -> None:
        set_key(_ENV_FILE, "ML_ACCESS_TOKEN", tokens["access_token"])
        if "refresh_token" in tokens:
            set_key(_ENV_FILE, "ML_REFRESH_TOKEN", tokens["refresh_token"])
        if "user_id" in tokens:
            set_key(_ENV_FILE, "ML_USER_ID", str(tokens["user_id"]))
            self.user_id = str(tokens["user_id"])

    def first_time_auth(self) -> None:
        url = self.get_auth_url()
        print(f"\nAbrí este link en tu navegador:\n{url}\n")
        webbrowser.open(url)
        print("Después de autorizar, vas a ser redirigido a una URL similar a:")
        print(f"  {self.redirect_uri}?code=XXXXXXX\n")
        code = input("Pegá aquí el valor del parámetro 'code' de esa URL: ").strip()
        tokens = self.exchange_code(code)
        self._save_tokens(tokens)
        self.access_token = tokens["access_token"]
        self.refresh_token = tokens.get("refresh_token")
        print("\n✓ Autenticación exitosa. Tokens guardados en .env\n")
