"""
Simple tests for core functionality
"""

def test_math_addition():
    """Test basic math"""
    assert 2 + 2 == 4

def test_string_operations():
    """Test string operations"""
    assert "hello" + "world" == "helloworld"
    assert len("test") == 4

def test_list_operations():
    """Test list operations"""
    items = [1, 2, 3, 4, 5]
    assert len(items) == 5
    assert items[0] == 1
    assert items[-1] == 5

def test_dict_operations():
    """Test dictionary operations"""
    data = {"name": "test", "value": 123}
    assert data["name"] == "test"
    assert "name" in data
