from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from .pricing import model_rates


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="AGENCY_", extra="ignore")
    environment: Literal["development", "production"] = "development"
    database_url: str = "sqlite:///./agency.db"
    allow_dev_auth: bool = True
    ai_mode: Literal["demo", "deepseek"] = "demo"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-flash"
    # Provider thinking is private; only grounded response explanations reach UI.
    ai_thinking: bool = True
    # Optional web grounding (Bocha). Grounding happens only for a turn where
    # the user explicitly enabled it; results are attributed, never facts.
    web_search_api_key: str = ""
    web_search_timeout_seconds: float = Field(default=10, gt=0, le=30)
    wechat_app_id: str = ""
    wechat_app_secret: str = ""
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    # AI allocation within the approved CNY 500 total monthly running budget.
    ai_monthly_budget_cny: Decimal = Field(default=Decimal("100"), ge=0, le=100)
    input_price_per_million: Decimal | None = Field(default=None, ge=0)
    output_price_per_million: Decimal | None = Field(default=None, ge=0)
    cached_input_price_per_million: Decimal | None = Field(default=None, ge=0)
    offpeak_price_multiplier: Decimal = Field(default=Decimal("0.5"), gt=0, le=1)
    # Explicit Chinese public holidays can be added without guessing a calendar.
    # An unknown weekday holiday is conservatively charged at the peak ceiling.
    deepseek_offpeak_dates: list[date] = []
    max_output_tokens: int = Field(default=4096, ge=256, le=4096)
    daily_chat_limit: int = Field(default=30, ge=1, le=200)
    ai_timeout_seconds: float = Field(default=45, gt=0, le=120)
    # Reviewed-library selections ride on the existing chat request.
    visual_selection_enabled: bool = True

    @model_validator(mode="after")
    def production_guard(self):
        prices = model_rates(self.deepseek_model)
        for name, price in zip(
            ("input_price_per_million", "cached_input_price_per_million", "output_price_per_million"),
            prices,
        ):
            configured = getattr(self, name)
            if configured is not None and configured != price:
                raise ValueError(f"{name} conflicts with selected model; remove stale price override")
            setattr(self, name, price)
        if self.ai_mode == "deepseek" and not self.deepseek_api_key:
            raise ValueError("deepseek mode requires AGENCY_DEEPSEEK_API_KEY")
        if self.environment == "production":
            if (
                self.allow_dev_auth
                or self.ai_mode != "deepseek"
                or self.database_url.startswith("sqlite")
                or not self.wechat_app_id
                or not self.wechat_app_secret
            ):
                raise ValueError(
                    "production requires real WeChat, PostgreSQL and AI; dev auth must be off"
                )
            if not self.deepseek_base_url.startswith("https://"):
                raise ValueError("production requires HTTPS upstream")
        return self
