


export enum ProductAvailabilityStatus {
  IN_STOCK = 'in_stock',
  OUT_OF_STOCK = 'out_of_stock',
  LOW_STOCK = 'low_stock',
  DISCONTINUED = 'discontinued',
  COMING_SOON = 'coming_soon',
}


export enum ProductCondition {
  NEW = 'new',
  REFURBISHED = 'refurbished',
  USED = 'used',
  DAMAGED = 'damaged',
}


export enum ProductVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}


export enum StockMovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  RETURN = 'return',
  ADJUSTMENT = 'adjustment',
  DAMAGE = 'damage',
  TRANSFER = 'transfer',
}


export enum ProductSortBy {
  NAME = 'name',
  PRICE = 'price',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  POPULARITY = 'popularity',
  RATING = 'rating',
}


export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

