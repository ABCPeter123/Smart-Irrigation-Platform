import os
from dataclasses import dataclass
from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class PipelineConfig:
    database_url: str
    default_site_area_hectares: float


def get_config() -> PipelineConfig:
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise ValueError("DATABASE_URL is missing. Add it to backend/data_pipeline/.env")

    return PipelineConfig(
        database_url=database_url,
        default_site_area_hectares=float(
            os.getenv("PIPELINE_DEFAULT_SITE_AREA_HECTARES", "1.0")
        ),
    )