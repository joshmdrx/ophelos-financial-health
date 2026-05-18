from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.enums import ExpenseCategory, IncomeCategory, LineItemType, is_valid_category


class LineItemBase(BaseModel):
    type: LineItemType
    category: IncomeCategory | ExpenseCategory
    label: str | None = Field(default=None, max_length=120)
    amount_minor: int = Field(ge=0)

    @model_validator(mode="after")
    def _category_matches_type(self):
        if not is_valid_category(self.type, self.category.value):
            raise ValueError(
                f"category '{self.category.value}' is not valid for type '{self.type.value}'"
            )
        return self


class LineItemCreate(LineItemBase):
    pass


class LineItemUpdate(BaseModel):
    type: LineItemType | None = None
    category: IncomeCategory | ExpenseCategory | None = None
    label: str | None = Field(default=None, max_length=120)
    amount_minor: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _category_matches_type(self):
        if self.type is not None and self.category is not None:
            if not is_valid_category(self.type, self.category.value):
                raise ValueError(
                    f"category '{self.category.value}' is not valid for type '{self.type.value}'"
                )
        return self


class LineItemRead(LineItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    statement_id: str
    created_at: datetime
    updated_at: datetime
