export type Product = {
	id: number,
	title: string
}

export function getProduct () : Product {
	return {
		id: Date.now(),
		title: 'Product Sample 2'
	}
}
